import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { preloadSounds, preloadAllSounds, preloadBattleSounds, resetSoundPreloadCache } from "@/lib/audio-preload";
import { audioState } from "@/lib/audio-state";

const createdAudio: Array<{ src: string; preload: string }> = [];

beforeEach(() => {
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.musicVolume = 0.0875;
  audioState.masterVolume = 1;
  createdAudio.length = 0;
  resetSoundPreloadCache();
  vi.stubGlobal(
    "Audio",
    class {
      src = "";
      preload = "";
      constructor(src?: string) {
        this.src = src ?? "";
        createdAudio.push(this);
      }
      canPlayType() {
        return "";
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preloadSounds", () => {
  it("warms each name via HTMLAudio preload", () => {
    preloadSounds(["a.ogg", "b.ogg"]);
    const warmed = createdAudio.filter((el) => el.preload === "auto");
    expect(warmed).toHaveLength(2);
    expect(warmed[0]?.src).toContain("a.");
    expect(warmed[1]?.src).toContain("b.");
  });
});

describe("preloadBattleSounds", () => {
  it("prioritizes the visible hand and current enemy sound set", () => {
    preloadBattleSounds(["slash", "frostbolt"], "skeleton");
    const urls = createdAudio.map((el) => el.src);
    expect(urls.some((url) => url.includes("sword-attack-1."))).toBe(true);
    expect(urls.some((url) => url.includes("ice-throw-1."))).toBe(true);
    expect(urls.some((url) => url.includes("swish-hit."))).toBe(true);
  });
});

describe("preloadAllSounds", () => {
  it("schedules sound preloading in batches across idle callbacks", () => {
    const AudioContextCtor = vi.fn();
    vi.stubGlobal("AudioContext", AudioContextCtor);

    const callbacks: IdleRequestCallback[] = [];
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      callbacks.push(cb);
      return 1;
    });

    preloadAllSounds();
    expect(AudioContextCtor).not.toHaveBeenCalled();
    expect(createdAudio.length).toBeGreaterThan(0);
    expect(callbacks.length).toBe(1);

    callbacks[0]!({ didTimeout: false, timeRemaining: () => 50 });

    expect(callbacks.length).toBe(2);
    expect(AudioContextCtor).not.toHaveBeenCalled();
  });
});
