import { battleEventSounds } from "@/lib/audio/sound-registry";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getSoundUrl } from "@/lib/audio";
import { preloadSounds, preloadAllSounds, preloadBattleSounds, resetSoundPreloadCache } from "@/lib/audio/preload";
import { audioState } from "@/lib/audio/state";
import { createdFakeAudio, soundedFakeAudio, installFakeAudio } from "../../helpers/fake-audio";
import { installCleanAudio } from "../../helpers/audio-fixture";

beforeEach(() => {
  installCleanAudio();
  audioState.sfxVolume = 0.35;
  audioState.musicVolume = 0.0875;
  audioState.masterVolume = 1;
});

const originalRequestIdleCallback = typeof window !== "undefined" ? window.requestIdleCallback : undefined;

afterEach(() => {
  resetSoundPreloadCache();
  vi.useRealTimers();
  if (typeof window !== "undefined") {
    if (originalRequestIdleCallback === undefined)
      delete (window as unknown as Record<string, unknown>).requestIdleCallback;
    else window.requestIdleCallback = originalRequestIdleCallback;
  }
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getSoundUrl", () => {
  it("serves OGG when the browser plays Vorbis", () => {
    installCleanAudio({ canPlayTypeResult: "maybe" });
    expect(getSoundUrl("sword-attack-1.ogg")).toContain("sounds/sword-attack-1.ogg");
  });

  it("falls back to MP3 when Vorbis is unsupported", () => {
    installCleanAudio({ canPlayTypeResult: "" });
    expect(getSoundUrl("sword-attack-1.ogg")).toContain("sounds/sword-attack-1.mp3");
  });

  it("passes non-OGG names through unchanged", () => {
    installCleanAudio({ canPlayTypeResult: "maybe" });
    expect(getSoundUrl("theme.mp3")).toContain("sounds/theme.mp3");
  });

  it("joins a base URL without a trailing slash", () => {
    installCleanAudio({ canPlayTypeResult: "" });
    vi.stubEnv("BASE_URL", "/app");
    expect(getSoundUrl("sword-attack-1.ogg")).toBe("/app/sounds/sword-attack-1.mp3");
  });
});

describe("preloadSounds", () => {
  it("continues warming later sounds after an Audio constructor fails", () => {
    const WorkingAudio = Audio;
    let first = true;
    vi.stubGlobal(
      "Audio",
      class extends WorkingAudio {
        constructor() {
          if (first) {
            first = false;
            throw new Error("temporary audio failure");
          }
          super();
        }
      },
    );
    expect(() => preloadSounds(["failed.ogg", "later.ogg"])).not.toThrow();
    expect(soundedFakeAudio().map((element) => element.src)).toEqual([getSoundUrl("later.ogg")]);
  });

  it("releases a failed source assignment and continues warming later sounds", () => {
    vi.useFakeTimers();
    let failedElement: (typeof createdFakeAudio)[number] | undefined;
    installFakeAudio({
      onCreate: (element) => {
        if (failedElement) return;
        failedElement = element;
        Object.defineProperty(element, "src", {
          get: () => "",
          set: () => {
            throw new Error("source failure");
          },
        });
      },
    });
    expect(() => preloadSounds(["failed-source.ogg", "later-source.ogg"])).not.toThrow();
    expect(failedElement?.pause).toHaveBeenCalledOnce();
    expect(failedElement?.load).toHaveBeenCalledOnce();
    expect(soundedFakeAudio().map((element) => element.src)).toEqual([getSoundUrl("later-source.ogg")]);
    expect(vi.getTimerCount()).toBe(1);
    resetSoundPreloadCache();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("warms each name via HTMLAudio preload", () => {
    vi.useFakeTimers();
    preloadSounds(["a.ogg", "b.ogg"]);
    const warmed = createdFakeAudio.filter((el) => el.preload === "auto");
    expect(warmed).toHaveLength(2);
    expect(warmed[0]?.src).toContain("a.");
    expect(warmed[1]?.src).toContain("b.");
    for (const element of warmed) {
      const source = element.src;
      const lateError = element.onerror!;
      element.oncanplaythrough?.();
      lateError();
      expect(element.oncanplaythrough).toBeNull();
      expect(element.onerror).toBeNull();
      expect(element.src).toBe(source);
      expect(element.load).not.toHaveBeenCalled();
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it("revokes aborted warmup callbacks before a replacement warmup starts", () => {
    vi.useFakeTimers();
    preloadSounds(["a.ogg"]);
    const old = soundedFakeAudio()[0]!;
    const lateError = old.onerror!;
    resetSoundPreloadCache();
    preloadSounds(["a.ogg"]);
    const replacement = soundedFakeAudio().at(-1)!;
    lateError();
    expect(old.load).toHaveBeenCalledOnce();
    expect(replacement.load).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("skips names already warming", () => {
    preloadSounds(["a.ogg"]);
    preloadSounds(["a.ogg"]);
    expect(soundedFakeAudio()).toHaveLength(1);
  });

  it("gives up on a name after its warmup errors instead of retry-storming", () => {
    preloadSounds(["a.ogg"]);
    const el = soundedFakeAudio().at(-1)!;
    el.onerror?.();
    preloadSounds(["a.ogg"]);
    expect(soundedFakeAudio()).toHaveLength(1);
  });
});

describe("preloadBattleSounds", () => {
  it("warms the sound for crafted Mixed Potions in the hand", () => {
    preloadBattleSounds(["constructor", "__proto__", "toString", "mixed-potion-health-potion-0-mana-potion-0"]);
    expect(createdFakeAudio.some((el) => el.src.includes("ice-in-water."))).toBe(true);
  });

  it("warms the visible hand without unrelated companion cues", () => {
    preloadBattleSounds(["slash", "frostbolt"]);
    const urls = createdFakeAudio.map((el) => el.src);
    expect(urls.some((url) => url.includes("sword-attack-1."))).toBe(true);
    expect(urls.some((url) => url.includes("ice-throw-1."))).toBe(true);
    expect(urls.some((url) => url.includes("swish-hit."))).toBe(false);
  });

  it("warms enemy ability card sounds alongside the hand", () => {
    preloadBattleSounds(["slash"], ["sunder"]);
    const urls = createdFakeAudio.map((el) => el.src);
    expect(urls.some((url) => url.includes("strong-punch."))).toBe(true);
  });

  it("warms the full battle event set including opening status cues", () => {
    preloadBattleSounds(["slash"]);
    const urls = createdFakeAudio.map((el) => el.src);
    for (const name of Object.values(battleEventSounds).filter((name) => name !== null)) {
      expect(urls.some((url) => url.includes(name))).toBe(true);
    }
  });
});

describe("preloadAllSounds", () => {
  it("does not permanently skip preload when Audio is unavailable at startup", () => {
    const callbacks: IdleRequestCallback[] = [];
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal("Audio", undefined);
    preloadAllSounds();
    expect(callbacks).toHaveLength(0);

    installCleanAudio();
    preloadAllSounds();
    expect(createdFakeAudio.length).toBeGreaterThan(0);
    expect(callbacks).toHaveLength(1);
  });

  it("ignores an idle preload callback after the cache is reset", () => {
    const callbacks: IdleRequestCallback[] = [];
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    preloadAllSounds();
    const started = createdFakeAudio.length;
    resetSoundPreloadCache();
    callbacks[0]!({ didTimeout: false, timeRemaining: () => 50 });
    expect(createdFakeAudio).toHaveLength(started);
  });

  it("preloads urgent sounds synchronously and the rest in exactly one idle callback across repeated requests", () => {
    const callbacks: IdleRequestCallback[] = [];
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      callbacks.push(cb);
      return 1;
    });

    preloadAllSounds();
    const urgentCount = createdFakeAudio.length;
    expect(urgentCount).toBeGreaterThan(0);
    preloadAllSounds();
    expect(createdFakeAudio).toHaveLength(urgentCount);
    expect(callbacks).toHaveLength(1);

    callbacks[0]!({ didTimeout: false, timeRemaining: () => 50 });
    const warmed = createdFakeAudio.length;
    expect(warmed).toBeGreaterThan(urgentCount);
    preloadAllSounds();
    expect(createdFakeAudio).toHaveLength(warmed);
    expect(callbacks).toHaveLength(1);
  });
});
