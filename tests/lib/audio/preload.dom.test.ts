import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getSoundUrl } from "@/lib/audio";
import {
  preloadSound,
  preloadSounds,
  preloadAllSounds,
  preloadBattleSounds,
  resetSoundPreloadCache,
} from "@/lib/audio/preload";
import { audioState } from "@/lib/audio/state";
import { createdFakeAudio, soundedFakeAudio } from "../../helpers/fake-audio";
import { installCleanAudio } from "../../helpers/audio-fixture";

beforeEach(() => {
  installCleanAudio();
  audioState.sfxVolume = 0.35;
  audioState.musicVolume = 0.0875;
  audioState.masterVolume = 1;
});

const originalRequestIdleCallback = typeof window !== "undefined" ? window.requestIdleCallback : undefined;

afterEach(() => {
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

  it("gives up on a name after its warmup errors instead of retry-storming", () => {
    preloadSounds(["a.ogg"]);
    const el = soundedFakeAudio().at(-1)!;
    el.onerror?.();
    preloadSounds(["a.ogg"]);
    expect(soundedFakeAudio()).toHaveLength(1);
  });

  it("warms a single sound via preloadSound", () => {
    preloadSound("single-sound.ogg");
    const warmed = createdFakeAudio.filter((el) => el.preload === "auto");
    expect(warmed).toHaveLength(1);
    expect(warmed[0]?.src).toContain("single-sound.");
  });

  it("cancels stall timers when resetSoundPreloadCache is called", () => {
    vi.useFakeTimers();
    preloadSound("stall-test.ogg");
    expect(soundedFakeAudio()).toHaveLength(1);

    resetSoundPreloadCache();
    // Advancing past the 30-second stall timer should not trigger any errors or unhandled events
    vi.advanceTimersByTime(35_000);

    vi.useRealTimers();
  });
});

describe("preloadBattleSounds", () => {
  it("warms the sound for crafted Mixed Potions in the hand", () => {
    preloadBattleSounds(["mixed-potion-health-potion-0-mana-potion-0"], "skeleton");
    expect(createdFakeAudio.some((el) => el.src.includes("ice-in-water."))).toBe(true);
  });

  it("prioritizes the visible hand and current enemy sound set", () => {
    preloadBattleSounds(["slash", "frostbolt"], "skeleton");
    const urls = createdFakeAudio.map((el) => el.src);
    expect(urls.some((url) => url.includes("sword-attack-1."))).toBe(true);
    expect(urls.some((url) => url.includes("ice-throw-1."))).toBe(true);
    expect(urls.some((url) => url.includes("swish-hit."))).toBe(true);
  });

  it("warms enemy ability card sounds alongside the hand", () => {
    preloadBattleSounds(["slash"], "skeleton", ["sunder"]);
    const urls = createdFakeAudio.map((el) => el.src);
    expect(urls.some((url) => url.includes("strong-punch."))).toBe(true);
  });

  it("warms the full battle event set including opening status cues", () => {
    preloadBattleSounds(["slash"], "skeleton");
    const urls = createdFakeAudio.map((el) => el.src);
    for (const name of [
      "sword-impact-hit-1.",
      "punch-3.",
      "power-down.",
      "ice-freeze-1.",
      "vibraphone-chime-quick.",
      "toggle-off.",
    ]) {
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

  it("preloads urgent sounds synchronously and the rest in one idle callback", async () => {
    const AudioContextCtor = vi.fn();
    vi.stubGlobal("AudioContext", AudioContextCtor);

    const callbacks: IdleRequestCallback[] = [];
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      callbacks.push(cb);
      return 1;
    });

    preloadAllSounds();
    expect(AudioContextCtor).not.toHaveBeenCalled();
    const urgentCount = createdFakeAudio.length;
    expect(urgentCount).toBeGreaterThan(0);
    expect(callbacks.length).toBe(1);

    callbacks[0]!({ didTimeout: false, timeRemaining: () => 50 });
    await vi.waitFor(() => expect(createdFakeAudio.length).toBeGreaterThan(urgentCount));
    expect(callbacks.length).toBe(1);

    expect(AudioContextCtor).not.toHaveBeenCalled();
  });

  it("is idempotent and does not schedule duplicate idle loops when called multiple times", () => {
    const callbacks: IdleRequestCallback[] = [];
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });

    preloadAllSounds();
    expect(callbacks).toHaveLength(1);

    // Second call should be a no-op:
    preloadAllSounds();
    expect(callbacks).toHaveLength(1);
  });
});
