import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { audioState } from "@/lib/audio-state";
import { playCombatTextSounds } from "@/features/alchemy/run-loop/battle/controller-utils";

const playedSrcs: string[] = [];

beforeEach(() => {
  playedSrcs.length = 0;
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.masterVolume = 1;
  audioState.lastPlayedAt = new Map();
  vi.stubGlobal(
    "Audio",
    class {
      src = "";
      volume = 1;
      muted = false;
      play = () => {
        playedSrcs.push(this.src);
        return Promise.resolve();
      };
      constructor(src?: string) {
        this.src = src ?? "";
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playCombatTextSounds", () => {
  it("plays enemyHit for enemy damage", () => {
    playCombatTextSounds([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
    expect(playedSrcs.some((src) => src.includes("sword-impact-hit-1."))).toBe(true);
  });

  it("plays blockAbsorb for player block absorb", () => {
    playCombatTextSounds([{ target: "player", kind: "damage", stat: "block", amount: 3 }]);
    expect(playedSrcs.some((src) => src.includes("sword-blocked-2."))).toBe(true);
  });

  it("plays playerHit for player health damage", () => {
    playCombatTextSounds([{ target: "player", kind: "damage", stat: "health", amount: 4 }]);
    expect(playedSrcs.some((src) => src.includes("punch-3."))).toBe(true);
  });

  it("plays playerHeal for player heal", () => {
    playCombatTextSounds([{ target: "player", kind: "heal", stat: "health", amount: 6 }]);
    expect(playedSrcs.some((src) => src.includes("vibraphone-chime-quick."))).toBe(true);
  });

  it("plays nothing for player status", () => {
    playCombatTextSounds([{ target: "player", kind: "status", stat: "block", amount: 5 }]);
    expect(playedSrcs).toEqual([]);
  });

  it("plays nothing for notice events", () => {
    playCombatTextSounds([{ target: "player", kind: "notice", stat: "health", text: "watched" }]);
    expect(playedSrcs).toEqual([]);
  });

  it("plays nothing for empty combat texts", () => {
    playCombatTextSounds([]);
    expect(playedSrcs).toEqual([]);
  });

  it("plays nothing for enemy heal", () => {
    playCombatTextSounds([{ target: "enemy", kind: "heal", stat: "health", amount: 2 }]);
    expect(playedSrcs).toEqual([]);
  });

  it("plays multiple events in one batch", () => {
    playCombatTextSounds([
      { target: "enemy", kind: "damage", stat: "physical", amount: 5 },
      { target: "player", kind: "heal", stat: "health", amount: 2 },
    ]);
    expect(playedSrcs.some((src) => src.includes("sword-impact-hit-1."))).toBe(true);
    expect(playedSrcs.some((src) => src.includes("vibraphone-chime-quick."))).toBe(true);
  });
});
