// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getAudioContext,
  resumeAudioContext,
  loadSoundBuffer,
  preloadSounds,
  preloadAllSounds,
  preloadBattleSounds,
} from "@/lib/audio-buffer-cache";
import { audioState } from "@/lib/audio-state";

beforeEach(() => {
  audioState.context = null;
  audioState.masterGain = null;
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.musicVolume = 0.0875;
  audioState.masterVolume = 1;
  audioState.audioUnlocked = false;
});

afterEach(() => {
  vi.restoreAllMocks();
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
    const resume = vi.fn(() => Promise.resolve());
    const mockCtx = { state: "suspended", resume } as unknown as Partial<AudioContext>;
    audioState.context = mockCtx as AudioContext;
    audioState.audioUnlocked = false;
    resumeAudioContext();
    expect(resume).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(audioState.audioUnlocked).toBe(true);
  });

  it("does not resume running context", () => {
    const resume = vi.fn(() => Promise.resolve());
    const mockCtx = { state: "running", resume } as unknown as Partial<AudioContext>;
    audioState.context = mockCtx as AudioContext;
    resumeAudioContext();
    expect(resume).not.toHaveBeenCalled();
  });
});

describe("loadSoundBuffer", () => {
  it("deduplicates concurrent loads of the same sound", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        return new Promise<Response>(() => {});
      }),
    );
    const p1 = loadSoundBuffer("dedup-concurrent.ogg");
    const p2 = loadSoundBuffer("dedup-concurrent.ogg");
    expect(p1).toBeInstanceOf(Promise);
    expect(p2).toBeInstanceOf(Promise);
  });

  it("returns null on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false })),
    );
    const result = await loadSoundBuffer("missing.ogg");
    expect(result).toBeNull();
  });

  it("retries after a failed load", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false }));
    vi.stubGlobal("fetch", fetchMock);
    await loadSoundBuffer("retry-missing.ogg");
    await loadSoundBuffer("retry-missing.ogg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null on decode failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })),
    );
    const mockCtx = {
      createGain: vi.fn(),
      destination: "dest",
      decodeAudioData: vi.fn(() => Promise.reject(new Error("decode failed"))),
    } as unknown as Partial<AudioContext>;
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return mockCtx;
        }
      },
    );
    const result = await loadSoundBuffer("bad.ogg");
    expect(result).toBeNull();
  });
});

describe("preloadSounds", () => {
  it("kicks off loading for each name", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    preloadSounds(["a.ogg", "b.ogg"]);
  });
});

describe("preloadBattleSounds", () => {
  it("prioritizes the visible hand and current enemy sound set", () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL) => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    preloadBattleSounds(["slash", "frostbolt"], "skeleton");
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.endsWith("sword-attack-1.ogg"))).toBe(true);
    expect(urls.some((url) => url.endsWith("ice-throw-1.ogg"))).toBe(true);
    expect(urls.some((url) => url.endsWith("swish-hit.ogg"))).toBe(true);
  });
});

describe("preloadAllSounds", () => {
  it("schedules sound preloading in batches across idle callbacks", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const mockCtx = {
      createGain: vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn() })),
      destination: "dest",
      state: "running",
    } as unknown as Partial<AudioContext>;
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return mockCtx;
        }
      },
    );

    const callbacks: IdleRequestCallback[] = [];
    window.requestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
      callbacks.push(cb);
      return 1;
    });

    preloadAllSounds();
    expect(fetchMock).toHaveBeenCalled();
    expect(callbacks.length).toBe(1);

    callbacks[0]({ didTimeout: false, timeRemaining: () => 50 });

    expect(callbacks.length).toBe(2);
  });
});
