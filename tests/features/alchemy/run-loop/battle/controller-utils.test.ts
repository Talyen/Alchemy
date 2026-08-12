import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as audioBufferCache from "@/lib/audio-buffer-cache";
import { audioState } from "@/lib/audio-state";
import { playCombatTextSounds } from "@/features/alchemy/run-loop/battle/controller-utils";

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
  } as unknown as Partial<AudioContext>;
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

describe("playCombatTextSounds", () => {
  it("plays enemyHit for enemy damage", () => {
    playCombatTextSounds([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
    expect(audioBufferCache.getCachedBuffer).toHaveBeenCalledWith("sword-impact-hit-1.ogg");
  });

  it("plays blockAbsorb for player block absorb", () => {
    playCombatTextSounds([{ target: "player", kind: "damage", stat: "block", amount: 3 }]);
    expect(audioBufferCache.getCachedBuffer).toHaveBeenCalledWith("sword-blocked-2.ogg");
  });

  it("plays playerHit for player health damage", () => {
    playCombatTextSounds([{ target: "player", kind: "damage", stat: "health", amount: 4 }]);
    expect(audioBufferCache.getCachedBuffer).toHaveBeenCalledWith("punch-3.ogg");
  });

  it("plays playerHeal for player heal", () => {
    playCombatTextSounds([{ target: "player", kind: "heal", stat: "health", amount: 6 }]);
    expect(audioBufferCache.getCachedBuffer).toHaveBeenCalledWith("vibraphone-chime-quick.ogg");
  });

  it("plays nothing for player status", () => {
    playCombatTextSounds([{ target: "player", kind: "status", stat: "block", amount: 5 }]);
    expect(audioBufferCache.getCachedBuffer).not.toHaveBeenCalled();
  });

  it("plays nothing for notice events", () => {
    playCombatTextSounds([{ target: "player", kind: "notice", stat: "health", text: "watched" }]);
    expect(audioBufferCache.getCachedBuffer).not.toHaveBeenCalled();
  });

  it("plays nothing for empty combat texts", () => {
    playCombatTextSounds([]);
    expect(audioBufferCache.getCachedBuffer).not.toHaveBeenCalled();
  });

  it("plays nothing for enemy heal", () => {
    playCombatTextSounds([{ target: "enemy", kind: "heal", stat: "health", amount: 2 }]);
    expect(audioBufferCache.getCachedBuffer).not.toHaveBeenCalled();
  });

  it("plays multiple events in one batch", () => {
    playCombatTextSounds([
      { target: "enemy", kind: "damage", stat: "physical", amount: 5 },
      { target: "player", kind: "heal", stat: "health", amount: 2 },
    ]);
    expect(audioBufferCache.getCachedBuffer).toHaveBeenCalledWith("sword-impact-hit-1.ogg");
    expect(audioBufferCache.getCachedBuffer).toHaveBeenCalledWith("vibraphone-chime-quick.ogg");
  });
});
