// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getAudioContext,
  resumeAudioContext,
  unlockAudioFromUserGesture,
  preloadSounds,
  preloadAllSounds,
  preloadBattleSounds,
  resetSoundPreloadCache,
} from "@/lib/audio-buffer-cache";
import { audioState } from "@/lib/audio-state";

const createdAudio: Array<{ src: string; preload: string }> = [];

beforeEach(() => {
  audioState.context = null;
  audioState.masterGain = null;
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.musicVolume = 0.0875;
  audioState.masterVolume = 1;
  audioState.audioUnlocked = false;
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  audioState.context = null;
  audioState.masterGain = null;
});

describe("getAudioContext", () => {
  function makeMockCtx() {
    const mockGain = { gain: { value: 0 }, connect: vi.fn() };
    return { createGain: vi.fn(() => mockGain), destination: "dest" } as unknown as Partial<AudioContext>;
  }

  it("creates AudioContext on first call", () => {
    const mockCtx = makeMockCtx();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return mockCtx;
        }
      },
    );
    const ctx = getAudioContext();
    expect(ctx).toBe(mockCtx);
    expect(mockCtx.createGain).toHaveBeenCalledOnce();
    expect(mockCtx.createGain!().connect).toHaveBeenCalledWith("dest");
  });

  it("returns existing AudioContext on subsequent calls", () => {
    const mockCtx = makeMockCtx();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return mockCtx;
        }
      },
    );
    const first = getAudioContext();
    const second = getAudioContext();
    expect(second).toBe(first);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
  });
});

describe("resumeAudioContext", () => {
  it("resumes suspended context", async () => {
    const mockCtx = {
      state: "suspended",
      resume: vi.fn(() => {
        mockCtx.state = "running";
        return Promise.resolve();
      }),
    };
    audioState.context = mockCtx as unknown as AudioContext;
    audioState.audioUnlocked = false;
    const unlocked = resumeAudioContext();
    expect(mockCtx.resume).toHaveBeenCalledOnce();
    await expect(unlocked).resolves.toBe(true);
    expect(audioState.audioUnlocked).toBe(true);
  });

  it("does not resume running context", async () => {
    const resume = vi.fn(() => Promise.resolve());
    const mockCtx = { state: "running", resume } as unknown as Partial<AudioContext>;
    audioState.context = mockCtx as AudioContext;
    await expect(resumeAudioContext()).resolves.toBe(true);
    expect(resume).not.toHaveBeenCalled();
  });

  it("creates AudioContext on first unlock gesture", async () => {
    const mockCtx = {
      state: "running",
      resume: vi.fn(() => Promise.resolve()),
      createGain: vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn() })),
      destination: "dest",
    } as unknown as Partial<AudioContext>;
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return mockCtx;
        }
      },
    );
    audioState.context = null;
    audioState.audioUnlocked = false;
    await expect(resumeAudioContext()).resolves.toBe(true);
    expect(audioState.context).toBe(mockCtx);
    expect(audioState.audioUnlocked).toBe(true);
  });

  it("primes a silent buffer while resuming", async () => {
    const source = { buffer: null as AudioBuffer | null, connect: vi.fn(), start: vi.fn() };
    const mockCtx = {
      state: "suspended",
      sampleRate: 48000,
      destination: "dest",
      createBuffer: vi.fn(() => ({})),
      createBufferSource: vi.fn(() => source),
      resume: vi.fn(() => {
        mockCtx.state = "running";
        return Promise.resolve();
      }),
    };
    audioState.context = mockCtx as unknown as AudioContext;
    await expect(unlockAudioFromUserGesture()).resolves.toBe(true);
    expect(source.start).toHaveBeenCalledOnce();
    expect(mockCtx.resume).toHaveBeenCalledOnce();
  });
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
