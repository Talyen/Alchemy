import { createFakeAudioElement, type FakeAudioElement } from "../../helpers/fake-audio";
import { createCleanup } from "@/lib/cleanup";
import { expect, it, beforeEach, vi, afterEach } from "vitest";
import { createMusicPlayer } from "@/lib/audio/music-player";
import { computeMusicVolume, getBossMusicKey } from "@/lib/audio/music-catalog";
import { MUSIC_KEYS, MUSIC_MASTER_GAIN } from "@/lib/game-constants";

function createHarness() {
  const elements: FakeAudioElement[] = [];
  function createElement(file: string): FakeAudioElement {
    const element = createFakeAudioElement(file);
    elements.push(element);
    return element;
  }
  const settings = { musicVolume: 0.5, masterVolume: 1, muted: false };
  const deps = {
    createElement: vi.fn(createElement),
    selectFile: (files: readonly string[]) => files[0],
    readSettings: () => settings,
    canPlay: vi.fn(() => true),
    now: () => Date.now(),
    schedule: vi.fn((callback: () => void, interval: number) => setInterval(callback, interval)),
    cancel: (timer: ReturnType<typeof setInterval>) => clearInterval(timer),
    reportFailure: vi.fn(),
  };
  const player = createMusicPlayer(deps);
  return { player, deps, settings, elements };
}

let player: ReturnType<typeof createMusicPlayer>;
let deps: ReturnType<typeof createHarness>["deps"];
let elements: ReturnType<typeof createHarness>["elements"];
beforeEach(() => {
  vi.useFakeTimers();
  ({ player, deps, elements } = createHarness());
});
afterEach(() => {
  player.reset();
  vi.useRealTimers();
});

it("keeps music initialization failures nonfatal and retries on the next request", () => {
  deps.createElement.mockImplementationOnce(() => {
    throw new Error("Audio initialization failed");
  });
  expect(() => player.playMusicImmediate(MUSIC_KEYS.MENU)).not.toThrow();
  expect(player.isMusicPaused()).toBe(true);
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  expect(elements.at(-1)?.paused).toBe(false);
});

it("releases a partially initialized music source before retrying", () => {
  const createElement = deps.createElement.getMockImplementation()!;
  deps.createElement.mockImplementationOnce((file) => {
    const element = createElement(file);
    Object.defineProperty(element, "currentTime", {
      set: () => {
        throw new Error("seek failed");
      },
    });
    return element;
  });
  player.playMusicImmediate(MUSIC_KEYS.BOSS_IRON_BEAR);
  const failed = elements[0]!;
  expect(failed.removeAttribute).toHaveBeenCalledWith("src");
  expect(failed.load).toHaveBeenCalledOnce();
  expect(player.readMusicPlayback()).toBeNull();
  player.playMusicImmediate(MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(elements[1]).toMatchObject({ currentTime: 6, paused: false });
});

it.each(["pause", "reset", "replace", "retry", "invalidate"] as const)(
  "ignores a play rejection after %s revokes the attempt",
  async (action) => {
    let reject!: (reason: Error) => void;
    const createElement = deps.createElement.getMockImplementation()!;
    deps.createElement.mockImplementationOnce((file) => {
      const element = createElement(file);
      element.play.mockImplementationOnce(
        () =>
          new Promise<void>((_, fail) => {
            reject = fail;
          }),
      );
      return element;
    });
    player.playMusicImmediate(MUSIC_KEYS.MENU);
    if (action === "pause") player.pauseAllMusic();
    if (action === "reset") player.reset();
    if (action === "replace") player.playMusicImmediate(MUSIC_KEYS.BATTLE);
    if (action === "retry") player.playMusic(MUSIC_KEYS.MENU);
    if (action === "invalidate") player.invalidateCacheForKey(MUSIC_KEYS.MENU);
    reject(new Error("late rejection"));
    await Promise.resolve();
    expect(deps.reportFailure).not.toHaveBeenCalled();
  },
);

it("reports a current blocked attempt and allows the same preview to retry", async () => {
  const createElement = deps.createElement.getMockImplementation()!;
  deps.createElement.mockImplementationOnce((file) => {
    const element = createElement(file);
    element.play.mockRejectedValueOnce(new Error("blocked"));
    return element;
  });
  player.previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  await Promise.resolve();
  expect(deps.reportFailure).toHaveBeenCalledOnce();
  player.previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(elements[0]?.paused).toBe(false);
  expect(elements).toHaveLength(1);
});

it("keeps synchronous music playback failures nonfatal and retries the cached track", () => {
  const createElement = deps.createElement.getMockImplementation()!;
  deps.createElement.mockImplementationOnce((file) => {
    const element = createElement(file);
    element.play.mockImplementationOnce(() => {
      throw new Error("Audio playback failed");
    });
    return element;
  });
  expect(() => player.playMusicImmediate(MUSIC_KEYS.MENU)).not.toThrow();
  const menu = elements.at(-1)!;
  expect(menu.paused).toBe(true);
  player.playMusic(MUSIC_KEYS.MENU);
  expect(menu.paused).toBe(false);
  expect(elements).toHaveLength(1);
});

it("keeps the volume curve, fade gain, boss boost, and saturation", () => {
  expect(computeMusicVolume({ musicVolume: 0.5, masterVolume: 0.5 })).toBe(0.25 * MUSIC_MASTER_GAIN);
  expect(computeMusicVolume({ musicVolume: 1, masterVolume: 1, isBoss: true })).toBe(1);
  expect(computeMusicVolume({ musicVolume: 0.5, masterVolume: 0.5, isBoss: true })).toBeCloseTo(0.455);
  expect(computeMusicVolume({ musicVolume: 0.5, masterVolume: 1, isBoss: true })).toBeCloseTo(0.91);
  expect(computeMusicVolume({ musicVolume: 0.5, masterVolume: 1, fadeGain: 0.25, isBoss: true })).toBeCloseTo(0.2275);
  expect(computeMusicVolume({ musicVolume: 0, masterVolume: 1 })).toBe(0);
});

it("resolves boss tracks and skips the Iron Bear intro", () => {
  expect(getBossMusicKey("forge-golem")).toBe(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(getBossMusicKey("frostwarden")).toBe(MUSIC_KEYS.BOSS_FROSTWARDEN);
  expect(getBossMusicKey("blight-treant")).toBe(MUSIC_KEYS.BOSS_BLIGHT_TREANT);
  expect(getBossMusicKey("iron-bear")).toBe(MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(getBossMusicKey("unknown-boss")).toBeUndefined();
  player.playMusicImmediate(MUSIC_KEYS.BOSS_IRON_BEAR);
  expect(elements.at(-1)).toMatchObject({ currentTime: 6, loop: true, paused: false });
});

it("caches tracks and preserves seek positions across switches", () => {
  player.playMusicImmediate(MUSIC_KEYS.BATTLE);
  const battle = elements.at(-1)!;
  battle.currentTime = 42;
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  expect(battle.paused).toBe(true);
  player.playMusicImmediate(MUSIC_KEYS.BATTLE);
  expect(battle).toMatchObject({ currentTime: 42, paused: false });
  expect(menu.paused).toBe(true);
  expect(elements).toHaveLength(2);
});

it("resumes the same paused element without replacing it", () => {
  expect(player.isMusicPaused()).toBe(true);
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  expect(player.isMusicPaused()).toBe(false);
  menu.pause();
  expect(player.isMusicPaused()).toBe(true);
  player.playMusic(MUSIC_KEYS.MENU);
  expect(menu.paused).toBe(false);
  expect(elements).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("fades out before starting the delayed incoming fade", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  expect(menu.volume).toBeCloseTo(0.25 * MUSIC_MASTER_GAIN);
  expect(elements).toHaveLength(1);
  vi.advanceTimersByTime(150);
  const battle = elements.at(-1)!;
  expect(battle.src).toContain("Battle");
  expect(menu.paused).toBe(true);
  expect(battle).toMatchObject({ volume: 0, paused: false });
  vi.advanceTimersByTime(600);
  expect(battle.volume).toBe(0);
  vi.advanceTimersByTime(1500);
  expect(battle.volume).toBeCloseTo(0.5 * MUSIC_MASTER_GAIN);
  expect(vi.getTimerCount()).toBe(0);
});

it("replaces an interrupted destination without resetting the outgoing gain", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  const interruptedVolume = menu.volume;
  player.playMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  vi.advanceTimersByTime(30);
  expect(menu.volume).toBeLessThan(interruptedVolume);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(3000);
  expect(elements.at(-1)?.src).toContain("The Forge Golem.mp3");
  expect(elements).toHaveLength(2);
  expect(menu.paused).toBe(true);
});

it("restores the current track when a pending switch is reversed", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  player.playMusic(MUSIC_KEYS.MENU);

  expect(menu).toMatchObject({ paused: false, volume: 0.5 * MUSIC_MASTER_GAIN });
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(3000);
  expect(elements).toHaveLength(1);
});

it("starts a different track without waiting to fade out paused music", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  player.pauseAllMusic();
  player.playMusic(MUSIC_KEYS.BATTLE);

  expect(elements.at(-1)?.src).toContain("Battle");
  expect(elements.at(-1)?.paused).toBe(false);
});

it("restores outgoing music after failed initialization and retries the destination", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements[0]!;
  deps.createElement.mockImplementationOnce(() => {
    throw new Error("initialization failed");
  });
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(400);
  expect(menu).toMatchObject({ paused: false, volume: 0.5 * MUSIC_MASTER_GAIN });
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(3000);
  expect(menu.paused).toBe(true);
  expect(elements[1]).toMatchObject({ paused: false, volume: 0.5 * MUSIC_MASTER_GAIN });
});

it("dedupes a pending destination and lets an immediate switch cancel it", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  expect(elements.at(-1)?.src).toContain("Battle");
  player.playMusicImmediate(MUSIC_KEYS.BOSS_FROSTWARDEN);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(3000);
  expect(elements.at(-1)?.src).toContain("The Frostwarden.mp3");
});

it("pauses during a switch and can then select the abandoned destination", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  player.pauseAllMusic();
  vi.advanceTimersByTime(3000);
  expect(menu).toMatchObject({ paused: true, muted: true });
  expect(elements).toHaveLength(1);
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(3000);
  expect(elements.at(-1)?.src).toContain("Battle");
  expect(elements.at(-1)).toMatchObject({ paused: false, muted: false, volume: 0.5 * MUSIC_MASTER_GAIN });
});

it("resumes a cancelled fade-in at audible gain and clears the forced pause mute", () => {
  player.playMusic(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  player.pauseAllMusic();
  player.playMusic(MUSIC_KEYS.MENU);
  expect(menu).toMatchObject({ paused: false, muted: false, volume: 0.5 * MUSIC_MASTER_GAIN });
  expect(vi.getTimerCount()).toBe(0);
});

it("invalidating the pending destination cancels its timer and preserves outgoing playback", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  player.playMusic(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(150);
  player.invalidateCacheForKey(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(3000);
  expect(elements).toHaveLength(1);
  expect(menu).toMatchObject({ paused: false, volume: 0.5 * MUSIC_MASTER_GAIN });
  expect(vi.getTimerCount()).toBe(0);
});

it("invalidating the outgoing track stops the transition and builds a fresh track on replay", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  menu.currentTime = 42;
  player.playMusic(MUSIC_KEYS.BATTLE);
  player.invalidateCacheForKey(MUSIC_KEYS.MENU);
  vi.advanceTimersByTime(3000);
  expect(menu.paused).toBe(true);
  expect(menu.removeAttribute).toHaveBeenCalledWith("src");
  expect(menu.load).toHaveBeenCalledOnce();
  expect(player.isMusicPaused()).toBe(true);
  expect(elements).toHaveLength(1);
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  expect(elements.at(-1)).not.toBe(menu);
  expect(elements.at(-1)?.paused).toBe(false);
});

it("invalidating an unrelated key preserves an incoming fade", () => {
  player.playMusic(MUSIC_KEYS.MENU);
  player.invalidateCacheForKey(MUSIC_KEYS.BATTLE);
  vi.advanceTimersByTime(3000);
  expect(elements.at(-1)).toMatchObject({ paused: false, volume: 0.5 * MUSIC_MASTER_GAIN });
});

it("reset cancels callbacks and drops cached boss elements", () => {
  player.playMusic(MUSIC_KEYS.BOSS_FROSTWARDEN);
  const boss = elements.at(-1)!;
  player.reset();
  expect(vi.getTimerCount()).toBe(0);
  expect(player.isMusicPaused()).toBe(true);
  player.playMusicImmediate(MUSIC_KEYS.BOSS_FROSTWARDEN);
  expect(elements.at(-1)).not.toBe(boss);
  expect(boss.paused).toBe(true);
  expect(boss.removeAttribute).toHaveBeenCalledWith("src");
  expect(boss.load).toHaveBeenCalledOnce();
});

it("dedupes previews, ignores unknown requests, and restores menu on preview end", () => {
  player.previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  player.previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  expect(elements).toHaveLength(1);
  player.playMusic("unknown-key");
  player.playMusicImmediate("unknown-key");
  player.endBossPreview();
  vi.advanceTimersByTime(3000);
  expect(elements.at(-1)?.src).toContain("Menu");
  expect(elements).toHaveLength(2);
});

it("screen selection and pause end preview ownership", () => {
  player.previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  player.playMusicImmediate(MUSIC_KEYS.BATTLE);
  player.endBossPreview();
  vi.advanceTimersByTime(3000);
  expect(elements.at(-1)?.src).toContain("Battle");
  player.previewBossMusic(MUSIC_KEYS.BOSS_FROSTWARDEN);
  player.pauseAllMusic();
  player.endBossPreview();
  vi.advanceTimersByTime(3000);
  expect(player.isMusicPaused()).toBe(true);
  expect(elements).toHaveLength(2);
});

it("does not play in a non-player host", () => {
  deps.canPlay.mockReturnValue(false);
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  expect(elements.at(-1)?.play).not.toHaveBeenCalled();
  expect(elements.at(-1)).toMatchObject({ paused: true, muted: true });
});

it("ignores inherited catalog keys without interrupting playback or creating preview ownership", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements.at(-1)!;
  for (const key of ["constructor", "toString", "__proto__"]) {
    player.playMusic(key);
    player.playMusicImmediate(key);
    player.previewBossMusic(key);
  }
  player.endBossPreview();
  expect(vi.getTimerCount()).toBe(0);
  expect(elements).toEqual([menu]);
  expect(menu).toMatchObject({ paused: false, volume: 0.5 * MUSIC_MASTER_GAIN });
});

it("owns tracks, settings, preview state, and cleanup independently for each player", () => {
  const other = createHarness();
  using _scopeCleanup = createCleanup(() => other.player.reset());

  player.previewBossMusic(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  other.settings.musicVolume = 0.2;
  other.player.playMusic(MUSIC_KEYS.MENU);
  const otherMenu = other.elements[0]!;
  player.reset();
  vi.advanceTimersByTime(3000);
  expect(elements[0]?.paused).toBe(true);
  expect(otherMenu).toMatchObject({ paused: false, volume: 0.2 * MUSIC_MASTER_GAIN });
  other.settings.muted = true;
  other.player.syncMusicSettings();
  expect(otherMenu.muted).toBe(true);
  other.player.endBossPreview();
  expect(other.elements).toEqual([otherMenu]);
  expect(vi.getTimerCount()).toBe(0);
});

it("ignores an already queued fade callback after reset and replacement playback", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  player.playMusic(MUSIC_KEYS.BATTLE);
  const staleCallback = deps.schedule.mock.calls[0]![0];
  const outgoing = elements[0]!;
  player.reset();
  player.playMusicImmediate(MUSIC_KEYS.BOSS_FORGE_GOLEM);
  const replacement = elements.at(-1)!;
  vi.advanceTimersByTime(3000);
  staleCallback();
  expect(elements).toHaveLength(2);
  expect(outgoing).toMatchObject({ paused: true });
  expect(outgoing.removeAttribute).toHaveBeenCalledWith("src");
  expect(replacement).toMatchObject({ paused: false });
  expect(replacement.volume).toBeCloseTo(0.91);
  expect(vi.getTimerCount()).toBe(0);
});

it("reports the active media clock through transitions, pause, loops, and invalidation", () => {
  expect(player.readMusicPlayback()).toBeNull();
  player.playMusicImmediate(MUSIC_KEYS.BOSS_BLIGHT_TREANT);
  const boss = elements.at(-1)!;
  boss.currentTime = 152;
  expect(player.readMusicPlayback()).toEqual({ key: MUSIC_KEYS.BOSS_BLIGHT_TREANT, currentTime: 152, audible: true });
  boss.currentTime = 0.7;
  expect(player.readMusicPlayback()?.currentTime).toBe(0.7);
  player.playMusic(MUSIC_KEYS.MENU);
  expect(player.readMusicPlayback()?.key).toBe(MUSIC_KEYS.BOSS_BLIGHT_TREANT);
  player.pauseAllMusic();
  expect(player.readMusicPlayback()?.audible).toBe(false);
  player.invalidateCacheForKey(MUSIC_KEYS.BOSS_BLIGHT_TREANT);
  expect(player.readMusicPlayback()).toBeNull();
});

it("retries a blocked outgoing track when its pending switch is reversed", async () => {
  const createElement = deps.createElement.getMockImplementation()!;
  deps.createElement.mockImplementationOnce((file) => {
    const element = createElement(file);
    element.play.mockRejectedValueOnce(new Error("blocked"));
    return element;
  });
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  await Promise.resolve();
  player.playMusic(MUSIC_KEYS.BATTLE);
  player.playMusic(MUSIC_KEYS.MENU);
  expect(elements[0]?.paused).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("invalidates an unseekable track without letting it retain a media source", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  const menu = elements[0]!;
  Object.defineProperty(menu, "currentTime", {
    set: () => {
      throw new Error("seek unavailable");
    },
  });
  expect(() => player.invalidateCacheForKey(MUSIC_KEYS.MENU)).not.toThrow();
  expect(menu.removeAttribute).toHaveBeenCalledWith("src");
  expect(menu.load).toHaveBeenCalledOnce();
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  expect(elements[1]?.paused).toBe(false);
});

it("revokes playback and releases all cached sources even if one pause fails during reset", () => {
  player.playMusicImmediate(MUSIC_KEYS.MENU);
  player.playMusicImmediate(MUSIC_KEYS.BATTLE);
  const battle = elements[1]!;
  battle.pause.mockImplementationOnce(() => {
    throw new Error("pause failed");
  });
  expect(() => player.reset()).not.toThrow();
  expect(player.readMusicPlayback()).toBeNull();
  for (const element of elements) {
    expect(element.removeAttribute).toHaveBeenCalledWith("src");
    expect(element.load).toHaveBeenCalledOnce();
  }
  expect(battle.pause).toHaveBeenCalledOnce();
  player.playMusicImmediate(MUSIC_KEYS.BATTLE);
  expect(elements[2]?.paused).toBe(false);
});
