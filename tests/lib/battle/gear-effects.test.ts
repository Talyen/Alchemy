import { describe, expect, it } from "vitest";
import {
  applyGearKillRewards,
  applyGearProcPhysicalDamage,
  gearFrozenDamageMultiplier,
  scaledGearLeechHeal,
} from "@/lib/battle/gear-effects";
import { applyGearDamageResistance, scaleGoldReward } from "@/lib/battle/types";
import { defaultGearEffects } from "@/lib/gear";
import { patchBattleState } from "./test-state";
import { defaultCcState } from "../../fixtures/default-battle-state";

describe("gear-effects", () => {
  it("reduces incoming damage by gear resist percent", () => {
    const gear = { ...defaultGearEffects, resistPhysical: 50 };
    expect(applyGearDamageResistance(10, "physical", gear)).toBe(5);
    expect(applyGearDamageResistance(10, "burn", gear)).toBe(10);
  });

  it("scales gold rewards by goldGainPercent", () => {
    const gear = { ...defaultGearEffects, goldGainPercent: 25 };
    expect(scaleGoldReward(100, gear)).toBe(125);
    expect(scaleGoldReward(100, defaultGearEffects)).toBe(100);
  });

  it("scales leech heal by leechHealBonusPercent", () => {
    const gear = { ...defaultGearEffects, leechHealBonusPercent: 50 };
    expect(scaledGearLeechHeal(4, gear)).toBe(6);
  });

  it("applies frozen enemy damage bonus multiplier", () => {
    const state = patchBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      gearEffects: { ...defaultGearEffects, frozenEnemyDamageBonusPercent: 50 },
    });
    expect(gearFrozenDamageMultiplier(state)).toBe(1.5);
    expect(gearFrozenDamageMultiplier(patchBattleState({ enemyCC: defaultCcState({ freezeSkipTurns: 0 }) }))).toBe(1);
  });

  it("includes frozen multiplier in gear proc physical damage", () => {
    const state = patchBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      gearEffects: { ...defaultGearEffects, frozenEnemyDamageBonusPercent: 100 },
    });
    expect(applyGearProcPhysicalDamage(state, 10)).toBe(20);
  });

  it("applies kill rewards with scaled gold", () => {
    const state = patchBattleState({
      enemyHealth: 0,
      gold: 5,
      playerHealth: 10,
      gearEffects: { ...defaultGearEffects, healOnKill: 3, goldOnKill: 4, goldGainPercent: 50 },
    });
    const texts: Parameters<typeof applyGearKillRewards>[2] = [];
    const next = applyGearKillRewards(state, true, texts);
    expect(next.playerHealth).toBe(13);
    expect(next.gold).toBe(11);
    expect(texts.some((t) => t.kind === "heal")).toBe(true);
    expect(texts.some((t) => t.stat === "gold" && (t as { amount: number }).amount === 6)).toBe(true);
  });
});
