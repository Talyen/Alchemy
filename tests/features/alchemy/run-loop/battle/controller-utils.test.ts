import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resetAudioRuntimeForTests } from "@/lib/audio/reset";
import * as audio from "@/lib/audio";
import { audioState } from "@/lib/audio/state";
import {
  defaultMeasureVisualCardRect,
  getCardTransferBatchSpeed,
  playCombatTextSounds,
  presentCombatTexts,
  transferCardIntervalSeconds,
} from "@/features/alchemy/run-loop/battle/controller-utils";

const playedSrcs: string[] = [];

beforeEach(() => {
  playedSrcs.length = 0;
  audioState.muted = false;
  audioState.sfxVolume = 0.35;
  audioState.masterVolume = 1;
  resetAudioRuntimeForTests();
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("playCombatTextSounds", () => {
  it("plays each cue once per batch and ignores non-impact and status-only changes", () => {
    const cues = vi.spyOn(audio, "playBattleEvent");
    playCombatTextSounds([
      { target: "enemy", kind: "damage", stat: "physical", amount: 5 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 2 },
      { target: "player", kind: "damage", stat: "block", amount: 3 },
      { target: "player", kind: "damage", stat: "health", amount: 4, impact: false },
      { target: "player", kind: "heal", stat: "health", amount: 6 },
      { target: "player", kind: "status", stat: "block", amount: 5 },
      { target: "enemy", kind: "heal", stat: "health", amount: 2 },
    ]);
    expect(cues.mock.calls.map(([name]) => name)).toEqual(["enemyHit", "blockAbsorb", "playerHeal"]);
    expect(playedSrcs).toHaveLength(3);
    expect(playedSrcs.filter((src) => src.includes("sword-impact-hit-1."))).toHaveLength(1);
    expect(playedSrcs.filter((src) => src.includes("sword-blocked-2."))).toHaveLength(1);
    expect(playedSrcs.filter((src) => src.includes("vibraphone-chime-quick."))).toHaveLength(1);
  });
});

describe("getCardTransferBatchSpeed", () => {
  it("uses small speed up to the small max and medium through the medium count", () => {
    expect(getCardTransferBatchSpeed(0)).toBe(1);
    expect(getCardTransferBatchSpeed(2)).toBe(1);
    expect(getCardTransferBatchSpeed(3)).toBe(1.4);
  });

  it("uses large speed above the medium count", () => {
    expect(getCardTransferBatchSpeed(4)).toBe(1.6);
    expect(getCardTransferBatchSpeed(10)).toBe(1.6);
  });
});

describe("transferCardIntervalSeconds", () => {
  it("scales duration by speed and adds the completion buffer in seconds", () => {
    expect(transferCardIntervalSeconds(0.3, 1.5, 50)).toBeCloseTo(0.25, 10);
  });
});

describe("defaultMeasureVisualCardRect", () => {
  it("uses border-box layout size so borders do not offset the transfer landing", () => {
    const scene = {
      offsetWidth: 1920,
      offsetHeight: 1080,
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 960, height: 540 }),
    } as HTMLDivElement;
    const card = {
      offsetWidth: 160,
      offsetHeight: 214,
      getBoundingClientRect: () => ({ left: 300, top: 200, width: 100, height: 140 }),
    } as HTMLElement;

    expect(defaultMeasureVisualCardRect(card, scene)).toEqual({
      x: 420,
      y: 333,
      width: 160,
      height: 214,
    });
  });
});

describe("presentCombatTexts", () => {
  it("shows texts, shakes the damaged side, and plays sounds in one call", () => {
    const presenter = { showCombatTexts: vi.fn(), shakeEnemy: vi.fn(), shakePlayer: vi.fn() };
    const events = [
      { target: "enemy", kind: "damage", stat: "physical", amount: 5 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 2 },
      { target: "player", kind: "damage", stat: "armor", amount: 1, impact: false },
    ] as const;
    presentCombatTexts(presenter, [...events]);
    expect(presenter.showCombatTexts).toHaveBeenCalledExactlyOnceWith(events);
    expect(presenter.shakeEnemy).toHaveBeenCalledOnce();
    expect(presenter.shakePlayer).not.toHaveBeenCalled();
  });

  it("is a no-op for empty events", () => {
    const presenter = { showCombatTexts: vi.fn(), shakeEnemy: vi.fn(), shakePlayer: vi.fn() };
    presentCombatTexts(presenter, []);
    expect(presenter.showCombatTexts).not.toHaveBeenCalled();
    expect(presenter.shakeEnemy).not.toHaveBeenCalled();
    expect(presenter.shakePlayer).not.toHaveBeenCalled();
  });
});
