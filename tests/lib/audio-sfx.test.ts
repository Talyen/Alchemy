import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getAudioContext } from "@/lib/audio-buffer-cache";
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

beforeEach(() => {
  audioState.context = makeMockAudioContext() as AudioContext;
  audioState.masterGain = { gain: { value: 0.3 }, connect: vi.fn() } as unknown as GainNode;
  audioState.muted = false;
  audioState.audioUnlocked = true;
  audioState.sfxVolume = 0.35;
  audioState.lastPlayedAt = new Map();
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

  it("stops active sources and clears the set", () => {
    getAudioContext();
    stopAllSfx();
    expect(() => stopAllSfx()).not.toThrow();
  });
});

describe("playCardSound", () => {
  it("does not throw for known card id", () => {
    expect(() => playCardSound("slash")).not.toThrow();
  });

  it("does nothing for unknown card id", () => {
    expect(() => playCardSound("nonexistent-card")).not.toThrow();
  });
});

describe("playGoldGain", () => {
  it("does not throw", () => {
    expect(() => playGoldGain()).not.toThrow();
  });
});

describe("playGoldSpend", () => {
  it("does not throw", () => {
    expect(() => playGoldSpend()).not.toThrow();
  });
});

describe("playEnemyAttack", () => {
  it("does not throw for known enemy id", () => {
    expect(() => playEnemyAttack("skeleton")).not.toThrow();
  });

  it("does nothing for unknown enemy id", () => {
    expect(() => playEnemyAttack("nonexistent-enemy")).not.toThrow();
  });
});

describe("playBattleEvent", () => {
  it("does not throw for known event", () => {
    expect(() => playBattleEvent("playerHit")).not.toThrow();
  });
});

describe("playUISound", () => {
  it("does not throw for known UI sound", () => {
    expect(() => playUISound("buttonHover")).not.toThrow();
  });

  it("does not throw for error sound", () => {
    expect(() => playUISound("error")).not.toThrow();
  });
});

describe("playVictory", () => {
  it("does not throw", () => {
    expect(() => playVictory()).not.toThrow();
  });
});

describe("playDefeat", () => {
  it("does not throw", () => {
    expect(() => playDefeat()).not.toThrow();
  });
});
