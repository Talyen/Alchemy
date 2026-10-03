import { battleEventSounds } from "@/lib/audio/sound-registry";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resetAudioRuntimeForTests } from "@/lib/audio/reset";
import * as audio from "@/lib/audio";
import { audioState } from "@/lib/audio/state";
import {
  defaultMeasureVisualCardRect,
  playCombatTextSounds,
  presentCombatTexts,
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
  it("distinguishes periodic ticks and resolved critical/control/resource signals from ordinary spell damage", () => {
    const cues = vi.spyOn(audio, "playBattleEvent");
    playCombatTextSounds([
      { target: "enemy", kind: "damage", stat: "burn", amount: 4 },
      { target: "enemy", kind: "damage", stat: "physical", amount: 8, critical: true },
      { target: "enemy", kind: "damage", stat: "burn", amount: 3, periodic: true },
      { target: "player", kind: "damage", stat: "bleed", amount: 2, periodic: true },
      { target: "player", kind: "notice", stat: "dodge", text: "Dodged" },
      { target: "player", kind: "status", stat: "armor", amount: 2 },
      { target: "player", kind: "status", stat: "forge", amount: 2 },
      { target: "enemy", kind: "notice", stat: "burn", text: "Wildfire" },
      { target: "enemy", kind: "notice", stat: "physical", text: "Shatter · Critical" },
    ]);
    expect(cues.mock.calls.map(([name]) => name)).toEqual([
      "enemyHit",
      "critHit",
      "burnTick",
      "bleedTick",
      "dodge",
      "armorChange",
      "forgeGain",
      "wildfire",
      "shatter",
    ]);
  });
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
    expect(playedSrcs.filter((src) => src.includes(battleEventSounds.enemyHit))).toHaveLength(1);
    expect(playedSrcs.filter((src) => src.includes(battleEventSounds.blockAbsorb))).toHaveLength(1);
    expect(playedSrcs.filter((src) => src.includes(battleEventSounds.playerHeal))).toHaveLength(1);
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
});
