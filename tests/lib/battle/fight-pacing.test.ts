import { describe, expect, it } from "vitest";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import {
  fightPacingClockMultiplier,
  fightPacingComebackMultiplier,
  fightPacingMultiplier,
  fightPacingPoolMetrics,
  openingPacedDamage,
  paceCombatMagnitude,
} from "@/lib/battle/fight-pacing";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { resolvePlayerCrowdControlTrigger } from "@/lib/battle/status-cc";
import { appliesFightPacingFromEnv } from "@/lib/balance";
import { FIGHT_PACING, STUN_THRESHOLD_FRACTION } from "@/lib/game-constants";
import type { BattleCardEffect } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestBattleState, makeTestCard } from "../../fixtures/battle";

function noCritRng() {
  return 0.99;
}

function pacedState(overrides: Parameters<typeof makeTestBattleState>[0] = {}): ReturnType<typeof makeTestBattleState> {
  return makeTestBattleState({ appliesFightPacing: true, rng: noCritRng, ...overrides });
}

const evenMetrics = {
  playerFraction: 1,
  enemyFraction: 1,
  actualBurnFraction: 0,
};

describe("appliesFightPacingFromEnv", () => {
  it("defaults on and accepts explicit boolean forms", () => {
    expect(appliesFightPacingFromEnv(undefined)).toBe(true);
    expect(appliesFightPacingFromEnv("on")).toBe(true);
    expect(appliesFightPacingFromEnv("1")).toBe(true);
    expect(appliesFightPacingFromEnv("true")).toBe(true);
    expect(appliesFightPacingFromEnv("off")).toBe(false);
    expect(appliesFightPacingFromEnv("0")).toBe(false);
    expect(appliesFightPacingFromEnv("false")).toBe(false);
    expect(() => appliesFightPacingFromEnv("")).toThrow("ALCHEMY_BALANCE_PACING");
    expect(() => appliesFightPacingFromEnv("sometimes")).toThrow("ALCHEMY_BALANCE_PACING");
  });
});

describe("fight pacing multipliers", () => {
  it("grants no comeback when HP fractions are even", () => {
    expect(fightPacingComebackMultiplier("player", evenMetrics)).toBe(1);
    expect(fightPacingComebackMultiplier("enemy", evenMetrics)).toBe(1);
  });

  it("grants the behind side at least +10% and leaves the ahead side at 1.0", () => {
    const playerBehind = { playerFraction: 0.5, enemyFraction: 1, actualBurnFraction: 0.25 };
    expect(fightPacingComebackMultiplier("player", playerBehind)).toBeGreaterThanOrEqual(1.1);
    expect(fightPacingComebackMultiplier("enemy", playerBehind)).toBe(1);

    const enemyBehind = { playerFraction: 1, enemyFraction: 0.5, actualBurnFraction: 0.25 };
    expect(fightPacingComebackMultiplier("enemy", enemyBehind)).toBeGreaterThanOrEqual(1.1);
    expect(fightPacingComebackMultiplier("player", enemyBehind)).toBe(1);
  });

  it("reaches +20% comeback at a 50% HP gap", () => {
    const gap = { playerFraction: 0.4, enemyFraction: 0.9, actualBurnFraction: 0.35 };
    expect(fightPacingComebackMultiplier("player", gap)).toBeCloseTo(1.2);
  });

  it("activates clock on a stalled high-HP fight and stays off when burn is ahead of schedule", () => {
    const stalled = { playerFraction: 1, enemyFraction: 1, actualBurnFraction: 0 };
    expect(fightPacingClockMultiplier(stalled, 4, "normal")).toBeGreaterThanOrEqual(1.1);

    const fast = { playerFraction: 0.2, enemyFraction: 0.2, actualBurnFraction: 0.8 };
    expect(fightPacingClockMultiplier(fast, 3, "normal")).toBe(1);
  });

  it("escalates the backstop after maxRounds", () => {
    const stalled = { playerFraction: 1, enemyFraction: 1, actualBurnFraction: 0 };
    const atCap = fightPacingClockMultiplier(stalled, FIGHT_PACING.clockByEnemyType.normal.maxRounds, "normal");
    const overrun = fightPacingClockMultiplier(stalled, FIGHT_PACING.clockByEnemyType.normal.maxRounds + 4, "normal");
    expect(overrun).toBeGreaterThanOrEqual(1.1);
    expect(overrun).toBeGreaterThanOrEqual(atCap);
  });
});

describe("paceCombatMagnitude", () => {
  it("returns the authored amount when fight pacing is disabled", () => {
    const state = makeTestBattleState({
      appliesFightPacing: false,
      playerHealth: 5,
      enemyHealth: 30,
    });
    expect(paceCombatMagnitude(state, 10, "player")).toBe(10);
  });

  it("leaves nested ticks unchanged when applyFightPacing is false", () => {
    const state = pacedState({ playerHealth: 5, enemyHealth: 30 });
    expect(paceCombatMagnitude(state, 10, "player", false)).toBe(10);
  });

  it("scales authored player damage when the player is behind", () => {
    const state = pacedState({ playerHealth: 8, playerMaxHealth: 30, enemyHealth: 30, enemyMaxHealth: 30 });
    expect(paceCombatMagnitude(state, 10, "player")).toBeGreaterThan(10);
    expect(paceCombatMagnitude(state, 10, "enemy")).toBeLessThanOrEqual(paceCombatMagnitude(state, 10, "player"));
  });

  it("matches clock × comeback", () => {
    const state = pacedState({ playerHealth: 8, playerMaxHealth: 30, enemyHealth: 30, turn: 4 });
    const expected = Math.round(10 * fightPacingMultiplier(state, "player"));
    expect(paceCombatMagnitude(state, 10, "player")).toBe(expected);
  });
});

describe("proc defensive grants bypass pacing (policy pin)", () => {
  it("grants CC-proc armor at authored magnitude even while the player is behind", () => {
    const base = pacedState({ playerHealth: 4, playerMaxHealth: 30, enemyHealth: 30, enemyMaxHealth: 30 });
    const armorAmount = 6;
    const state = { ...base, gearEffects: { ...base.gearEffects, armorOnStunOrFreeze: armorAmount } };
    expect(paceCombatMagnitude(state, 10, "player")).toBeGreaterThan(10);
    const texts: CombatTextEvent[] = [];
    const triggered = resolvePlayerCrowdControlTrigger({
      state,
      stat: "stun",
      stackValue: 999,
      thresholdFraction: STUN_THRESHOLD_FRACTION,
      combatTexts: texts,
    });
    expect(triggered.playerStatuses.armor).toBe(armorAmount);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "armor", amount: armorAmount });
  });
});

describe("openingPacedDamage", () => {
  it("matches a fresh full-health turn-1 battle through the live pipeline", () => {
    const state = pacedState();
    expect(openingPacedDamage(10)).toBe(paceCombatMagnitude(state, 10, "player"));
  });

  it("leaves fresh turn-1 openings at authored amount under lengthened targets", () => {
    expect(openingPacedDamage(10, "normal")).toBe(10);
    expect(openingPacedDamage(10, "boss")).toBe(10);
  });

  it("passes non-positive amounts through untouched", () => {
    expect(openingPacedDamage(0)).toBe(0);
    expect(openingPacedDamage(-5)).toBe(-5);
  });
});

describe("fight pacing in combat pipelines", () => {
  const physical: Extract<BattleCardEffect, { kind: "damage" }> = {
    kind: "damage",
    damageType: "physical",
    amount: 10,
  };

  it("scales card damage before block", () => {
    const state = pacedState({
      playerHealth: 8,
      playerMaxHealth: 30,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { armor: 0, forge: 0, block: 0 },
    });
    const { modifiedDamage } = computeCardDamageToEnemy(state, physical);
    expect(modifiedDamage).toBe(paceCombatMagnitude(state, 10, "player"));
  });

  it("keeps equal-to-stat damage independent of per-type modifiers", () => {
    const base = pacedState({
      playerHealth: 8,
      playerMaxHealth: 30,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      playerStatuses: { ...pacedState().playerStatuses, block: 10 },
      talentEffects: { ...pacedState().talentEffects, flatPhysicalDamage: 99 },
      gearEffects: { ...pacedState().gearEffects, flatPhysicalDamage: 99 },
      enemyMitigation: { armor: 0, forge: 0, block: 0 },
    });
    const equalToBlockEffect: Extract<BattleCardEffect, { kind: "damage" }> = {
      kind: "damage",
      damageType: "physical",
      amount: 0,
      equalToBlock: true,
    };
    const { modifiedDamage } = computeCardDamageToEnemy(base, equalToBlockEffect);
    expect(modifiedDamage).toBe(paceCombatMagnitude(base, 10, "player"));
  });

  it("does not double-pace stun stacks copied from actual damage", () => {
    const state = pacedState({
      playerHealth: 8,
      playerMaxHealth: 30,
      enemyHealth: 40,
      enemyMaxHealth: 40,
      enemyMitigation: { armor: 0, forge: 0, block: 0 },
    });
    const stunCard = makeTestCard({
      id: "stun-hit",
      title: "Stun Hit",
      effects: [{ kind: "damage", damageType: "stun", amount: 10 }],
    });
    const next = applyCardEffects(state, stunCard, []);
    const expectedDamage = paceCombatMagnitude(state, 10, "player");
    expect(state.enemyHealth - next.enemyHealth).toBe(expectedDamage);
    expect(next.enemyStatuses.stun).toBe(expectedDamage);
  });

  it("does not re-pace burn ticks of stacks copied from a paced hit", () => {
    const state = pacedState({
      playerHealth: 8,
      playerMaxHealth: 30,
      enemyHealth: 40,
      enemyMaxHealth: 40,
      enemyMitigation: { armor: 0, forge: 0, block: 0 },
      enemyStatuses: { ...makeTestBattleState().enemyStatuses, burn: 10 },
    });
    const pacedTick = paceCombatMagnitude(state, 10, "player");
    expect(pacedTick).toBeGreaterThan(10);
    const next = tickEnemyStatuses(state, []);
    expect(state.enemyHealth - next.enemyHealth).toBe(10);
  });

  it("reports pooled HP fractions from player vs enemy", () => {
    const state = pacedState({
      playerHealth: 15,
      playerMaxHealth: 30,
      enemyHealth: 10,
      enemyMaxHealth: 40,
    });
    expect(fightPacingPoolMetrics(state)).toEqual({
      playerFraction: 0.5,
      enemyFraction: 0.25,
      actualBurnFraction: (30 + 40 - 15 - 10) / 70,
    });
  });
});
