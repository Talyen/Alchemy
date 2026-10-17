import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createSfxPlayer } from "@/lib/audio/sfx-player";
import { createFakeAudioElement, type FakeAudioElement, type FakeAudioOptions } from "../../helpers/fake-audio";

let elements: FakeAudioElement[];
let settings: { muted: boolean; sfxVolume: number; masterVolume: number };
let elementOptions: FakeAudioOptions;
let player: ReturnType<typeof createSfxPlayer>;
function configureElements(options: FakeAudioOptions = {}) {
  elementOptions = options;
  elements.length = 0;
}
beforeEach(() => {
  vi.useFakeTimers();
  elements = [];
  elementOptions = {};
  settings = { muted: false, sfxVolume: 0.35, masterVolume: 1 };
  player = createSfxPlayer({
    createElement: (name) => {
      const element = createFakeAudioElement(name, elementOptions);
      elements.push(element);
      return element;
    },
    readSettings: () => settings,
    now: () => Date.now(),
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: (timer) => clearTimeout(timer),
  });
});
afterEach(() => {
  player.reset();
  vi.useRealTimers();
});

describe("cooldown, delay, and cancellation", () => {
  it("suppresses a repeat play inside the cooldown window", () => {
    player.play("slash");
    player.play("slash");
    expect(elements).toHaveLength(1);
  });

  it("plays the first sound even when the clock starts at zero", () => {
    vi.setSystemTime(0);
    player.play("playerHit");
    expect(elements).toHaveLength(1);
  });

  it("honors an explicit zero cooldown", () => {
    player.play("playerHit", { cooldownMs: 0 });
    player.play("playerHit", { cooldownMs: 0 });
    expect(elements).toHaveLength(2);
  });

  it("defers playback until the delay elapses", () => {
    player.play("playerHit", { delay: 1, cooldownMs: 0 });
    expect(elements).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(elements).toHaveLength(1);
  });

  it("lets an immediate cue play before a future cue of the same sound", () => {
    player.play("playerHit", { delay: 1 });
    player.play("playerHit");
    expect(elements).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(elements).toHaveLength(2);
  });

  it("recovers when play throws synchronously", () => {
    configureElements({
      onCreate: (element) => {
        element.play.mockImplementationOnce(() => {
          throw new Error("play failed");
        });
      },
    });
    expect(() => player.play("playerHit")).not.toThrow();
    configureElements();
    player.play("playerHit");
    expect(elements).toHaveLength(1);
  });

  it("cancels a delayed battle sound and its timer on stop", () => {
    player.play("playerHit", { delay: 1, cooldownMs: 0 });
    expect(vi.getTimerCount()).toBe(1);
    player.stopBattleSounds();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(elements).toHaveLength(0);
  });

  it("keeps delayed ambient sounds scheduled when battle sounds stop", () => {
    player.play("playerHit", { delay: 1, cooldownMs: 0, trackForCleanup: false });
    player.stopBattleSounds();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(elements).toHaveLength(1);
  });

  it("skips a delayed play muted after scheduling", () => {
    player.play("playerHit", { delay: 1, cooldownMs: 0 });
    settings.muted = true;
    vi.advanceTimersByTime(1000);
    expect(elements).toHaveLength(0);
  });

  it("releases the cooldown for a stopped batch of delayed draw sounds", () => {
    player.play("drawTransfer", { delay: 0.5 });
    player.play("drawTransfer", { delay: 1 });
    player.stopBattleSounds();
    expect(vi.getTimerCount()).toBe(0);
    player.play("drawTransfer");
    expect(elements).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(elements).toHaveLength(1);
  });

  it("clears delayed sound timers on runtime reset", () => {
    player.play("playerHit", { delay: 1 });
    player.reset();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(elements).toHaveLength(0);
  });

  it("releases the cooldown when a delayed play is muted before firing", () => {
    player.play("playerHit", { delay: 1 });
    settings.muted = true;
    vi.advanceTimersByTime(1000);
    expect(elements).toHaveLength(0);

    settings.muted = false;
    // Default cooldown applies: without the release this stays suppressed.
    player.play("playerHit");
    expect(elements).toHaveLength(1);
  });
});

describe("SFX lifetime", () => {
  it("releases an ended media source exactly once and ignores late failures", () => {
    player.play("slash");
    const el = elements.at(-1)!;
    const ended = el.onended!;
    const failed = el.onerror!;
    ended();
    ended();
    failed();
    player.stopBattleSounds();
    expect(el.pause).toHaveBeenCalledOnce();
    expect(el.removeAttribute).toHaveBeenCalledWith("src");
    expect(el.load).toHaveBeenCalledOnce();
    expect(el.onended).toBeNull();
    expect(el.onerror).toBeNull();
  });

  it("releases a failed element from later stops", () => {
    player.play("slash");
    const el = elements.at(-1)!;
    el.onerror?.();
    expect(el.pause).toHaveBeenCalledOnce();
    expect(el.removeAttribute).toHaveBeenCalledWith("src");
    player.stopBattleSounds();
    expect(el.pause).toHaveBeenCalledOnce();
  });

  it("releases an element whose play rejects", async () => {
    configureElements({ rejectPlay: true });
    player.play("slash");
    const el = elements.at(-1)!;
    await Promise.resolve();
    player.stopBattleSounds();
    expect(el.pause).toHaveBeenCalledOnce();
    expect(el.removeAttribute).toHaveBeenCalledWith("src");
  });
});

it("ambient SFX bound caps fire-and-forget sounds when ended handlers never fire", () => {
  // Cooldown is 80ms: step past it between plays so every play lands. The
  // first play lands without a warmup step (a never-played sound has no
  // cooldown). 34 plays (cap 32 + 2) prove eviction with fewer timer steps.
  for (let i = 0; i < 34; i += 1) {
    player.play("error", { trackForCleanup: false });
    vi.advanceTimersByTime(100);
  }
  expect(elements).toHaveLength(34);
  // The oldest entry was paused out by the cap; the newest is still live.
  expect(elements[0]?.pause).toHaveBeenCalled();
  // Eviction also releases the source so the stuck element cannot keep a
  // fetch attached (same release path as stopAllSfx/preload abort).
  expect(elements[0]?.removeAttribute).toHaveBeenCalledWith("src");
  const live = elements.at(-1)!;
  expect(live.pause).not.toHaveBeenCalled();
  settings.muted = true;
  player.syncSettings();
  expect(live.muted).toBe(true);
  player.stopBattleSounds();
  expect(live.pause).not.toHaveBeenCalled();
});

describe("cue ownership", () => {
  it("keeps the newer cooldown when an older play rejects in the same clock tick", async () => {
    let rejectFirst!: (reason: Error) => void;
    let created = 0;
    configureElements({
      onCreate: (element) => {
        if (!element.src || created++ > 0) return;
        element.play.mockImplementationOnce(
          () =>
            new Promise<void>((_, reject) => {
              rejectFirst = reject;
            }),
        );
      },
    });
    player.play("playerHit", { cooldownMs: 0 });
    const rejected = elements.at(-1)!;
    player.play("playerHit", { cooldownMs: 0 });
    const newest = elements.at(-1)!;
    rejectFirst(new Error("blocked"));
    await Promise.resolve();
    player.play("playerHit");
    expect(elements.at(-1)).toBe(newest);
    expect(rejected.removeAttribute).toHaveBeenCalledWith("src");
  });

  it("disposes every cue on reset and ignores failure from the old runtime", async () => {
    let rejectOld!: (reason: Error) => void;
    configureElements({
      onCreate: (element) => {
        if (!element.src) return;
        element.play.mockImplementationOnce(
          () =>
            new Promise<void>((_, reject) => {
              rejectOld = reject;
            }),
        );
      },
    });
    player.play("error", { trackForCleanup: false });
    const old = elements.at(-1)!;
    player.play("playerHit", { delay: 1 });
    player.reset();
    expect(old.pause).toHaveBeenCalledOnce();
    expect(old.onended).toBeNull();
    expect(old.onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    configureElements();
    player.play("error", { trackForCleanup: false });
    const current = elements.at(-1)!;
    rejectOld(new Error("late failure"));
    await Promise.resolve();
    player.play("error", { trackForCleanup: false });
    expect(elements).toEqual([current]);
    expect(old.pause).toHaveBeenCalledOnce();
  });

  it("allows retry after a media error without waiting for cooldown", () => {
    player.play("playerHit");
    const failed = elements.at(-1)!;
    failed.onerror?.();
    player.play("playerHit");
    expect(elements.at(-1)).not.toBe(failed);
    expect(elements.at(-1)?.play).toHaveBeenCalledOnce();
    expect(failed.onended).toBeNull();
    expect(failed.onerror).toBeNull();
  });
});
