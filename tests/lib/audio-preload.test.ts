import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getSoundUrl,
  preloadSounds,
  preloadAllSounds,
  preloadBattleSounds,
  resetSoundPreloadCache,
} from "@/lib/audio-preload";
import { audioState } from "@/lib/audio-state";
import { createdFakeAudio, installFakeAudio, soundedFakeAudio } from "../helpers/fake-audio";

beforeEach(() => {
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.musicVolume = 0.0875;
  audioState.masterVolume = 1;
  resetSoundPreloadCache();
  installFakeAudio();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getSoundUrl", () => {
  it("serves OGG when the browser plays Vorbis", () => {
    installFakeAudio({ canPlayTypeResult: "maybe" });
    resetSoundPreloadCache();
    expect(getSoundUrl("sword-attack-1.ogg")).toContain("sounds/sword-attack-1.ogg");
  });

  it("falls back to MP3 when Vorbis is unsupported", () => {
    expect(getSoundUrl("sword-attack-1.ogg")).toContain("sounds/sword-attack-1.mp3");
  });

  it("passes non-OGG names through unchanged", () => {
    installFakeAudio({ canPlayTypeResult: "maybe" });
    resetSoundPreloadCache();
    expect(getSoundUrl("theme.mp3")).toContain("sounds/theme.mp3");
  });

  it("joins a base URL without a trailing slash", () => {
    vi.stubEnv("BASE_URL", "/app");
    expect(getSoundUrl("sword-attack-1.ogg")).toBe("/app/sounds/sword-attack-1.mp3");
  });
});

describe("preloadSounds", () => {
  it("warms each name via HTMLAudio preload", () => {
    preloadSounds(["a.ogg", "b.ogg"]);
    const warmed = createdFakeAudio.filter((el) => el.preload === "auto");
    expect(warmed).toHaveLength(2);
    expect(warmed[0]?.src).toContain("a.");
    expect(warmed[1]?.src).toContain("b.");
  });

  it("skips names already warming", () => {
    preloadSounds(["a.ogg"]);
    preloadSounds(["a.ogg"]);
    expect(soundedFakeAudio()).toHaveLength(1);
  });

  it("retries a name after its warmup errors", () => {
    preloadSounds(["a.ogg"]);
    const el = soundedFakeAudio().at(-1)!;
    el.onerror?.();
    preloadSounds(["a.ogg"]);
    expect(soundedFakeAudio()).toHaveLength(2);
  });
});

describe("preloadBattleSounds", () => {
  it("prioritizes the visible hand and current enemy sound set", () => {
    preloadBattleSounds(["slash", "frostbolt"], "skeleton");
    const urls = createdFakeAudio.map((el) => el.src);
    expect(urls.some((url) => url.includes("sword-attack-1."))).toBe(true);
    expect(urls.some((url) => url.includes("ice-throw-1."))).toBe(true);
    expect(urls.some((url) => url.includes("swish-hit."))).toBe(true);
  });
});

describe("preloadAllSounds", () => {
  it("schedules sound preloading in batches across idle callbacks", async () => {
    const AudioContextCtor = vi.fn();
    vi.stubGlobal("AudioContext", AudioContextCtor);

    const callbacks: IdleRequestCallback[] = [];
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      callbacks.push(cb);
      return 1;
    });

    preloadAllSounds();
    expect(AudioContextCtor).not.toHaveBeenCalled();
    expect(createdFakeAudio.length).toBeGreaterThan(0);
    expect(callbacks.length).toBe(1);

    callbacks[0]!({ didTimeout: false, timeRemaining: () => 50 });
    await vi.waitFor(() => expect(callbacks.length).toBe(2));

    expect(AudioContextCtor).not.toHaveBeenCalled();
  });
});
