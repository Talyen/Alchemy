import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as audioBufferCache from "@/lib/audio-buffer-cache";
import { audioState } from "@/lib/audio-state";
import {
  stopAllSfx,
  playCardSound,
  playGoldGain,
  playGoldSpend,
  playEnemyAttack,
  playBattleEvent,
  playUISound,
  playVictory,
  playDefeat,
} from "@/lib/audio-sfx";

const fakeBuffer = { duration: 0.5 } as AudioBuffer;

function makeMockAudioContext() {
  const gain = { value: 0, connect: vi.fn() };
  return {
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
    createGain: vi.fn(() => ({ gain, connect: vi.fn() })),
    destination: "dest",
    currentTime: 0,
  } as Partial<AudioContext>;
}

function lastCreatedSource(ctx: AudioContext) {
  const createBufferSource = ctx.createBufferSource as ReturnType<typeof vi.fn>;
  return createBufferSource.mock.results.at(-1)?.value as { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
}

function expectLastSourceStarted() {
  const source = lastCreatedSource(audioState.context!);
  expect(source.start).toHaveBeenCalledOnce();
}

beforeEach(() => {
  audioState.context = makeMockAudioContext() as AudioContext;
  audioState.masterGain = { gain: { value: 0.3 }, connect: vi.fn() } as unknown as GainNode;
  audioState.muted = false;
  audioState.audioUnlocked = true;
  audioState.sfxVolume = 0.35;
  audioState.lastPlayedAt = new Map();
  vi.spyOn(audioBufferCache, "getCachedBuffer").mockReturnValue(fakeBuffer);
});

afterEach(() => {
  vi.restoreAllMocks();
  audioState.context = null;
  audioState.masterGain = null;
});

describe("stopAllSfx", () => {
  it("runs without error when no active sources", () => {
    expect(() => stopAllSfx()).not.toThrow();
  });

  it("stops battle-tracked sources", () => {
    playCardSound("slash");
    const source = lastCreatedSource(audioState.context!);
    stopAllSfx();
    expect(source.stop).toHaveBeenCalledOnce();
  });

  it("does not stop UI sounds", () => {
    playUISound("buttonHover");
    const source = lastCreatedSource(audioState.context!);
    stopAllSfx();
    expect(source.stop).not.toHaveBeenCalled();
  });

  it("does not stop victory stingers", () => {
    playVictory();
    const source = lastCreatedSource(audioState.context!);
    stopAllSfx();
    expect(source.stop).not.toHaveBeenCalled();
  });
});

describe("playCardSound", () => {
  it("plays audio for known card id", () => {
    playCardSound("slash");
    expect(audioState.context!.createBufferSource).toHaveBeenCalled();
    expectLastSourceStarted();
  });

  it("does nothing for unknown card id", () => {
    playCardSound("nonexistent-card");
    expect(audioState.context!.createBufferSource).not.toHaveBeenCalled();
  });
});

describe("playGoldGain", () => {
  it("plays gold gain audio", () => {
    playGoldGain();
    expectLastSourceStarted();
  });
});

describe("playGoldSpend", () => {
  it("plays gold spend audio", () => {
    playGoldSpend();
    expectLastSourceStarted();
  });
});

describe("playEnemyAttack", () => {
  it("plays audio for known enemy id", () => {
    playEnemyAttack("skeleton");
    expectLastSourceStarted();
  });

  it("does nothing for unknown enemy id", () => {
    playEnemyAttack("nonexistent-enemy");
    expect(audioState.context!.createBufferSource).not.toHaveBeenCalled();
  });
});

describe("playBattleEvent", () => {
  it("plays audio for known event", () => {
    playBattleEvent("playerHit");
    expectLastSourceStarted();
  });
});

describe("playUISound", () => {
  it("plays audio for known UI sound", () => {
    playUISound("buttonHover");
    expectLastSourceStarted();
  });

  it("plays audio for error sound", () => {
    playUISound("error");
    expectLastSourceStarted();
  });
});

describe("playVictory", () => {
  it("plays victory stinger", () => {
    playVictory();
    expectLastSourceStarted();
  });
});

describe("playDefeat", () => {
  it("plays defeat stinger", () => {
    playDefeat();
    expectLastSourceStarted();
  });
});
