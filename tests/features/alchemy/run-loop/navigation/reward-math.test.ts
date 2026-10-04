import { describe, expect, it } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import {
  applyLabyrinthRewardMaterialModifiers,
  computeVictoryGold,
} from "@/features/alchemy/run-loop/navigation/reward-math";

describe("victory reward settlement", () => {
  it("includes every bonus before rounding earnings once, preserving the purse", () => {
    const input = Object.freeze({
      battleState: Object.freeze({ gold: 65 }),
      purseGold: 50,
      runBoons: ["smugglers-map"],
      gold: 10,
      eliteBonus: 3,
      generousBonus: 4,
      wealthyBonus: 12,
      bossBonus: 5,
      talentGoldPerCombat: 2,
      goldMultiplier: 1.5,
    });
    expect(computeVictoryGold(input)).toEqual({ earnedBeforeMultiplier: 53, persistedGold: 130 });
    expect(input.battleState.gold).toBe(65);
    expect(input.purseGold).toBe(50);
  });

  it("never charges the purse for a negative in-combat balance, even with a reward multiplier", () => {
    expect(
      computeVictoryGold({
        battleState: { gold: 4 },
        purseGold: 10,
        runBoons: [],
        gold: 3,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 0,
        talentGoldPerCombat: 0,
        goldMultiplier: 2,
      }),
    ).toEqual({ earnedBeforeMultiplier: 3, persistedGold: 16 });
  });

  it("adds Herbalist after Scavenger, applies only matching traits, and preserves the original materials", () => {
    const materials = Object.freeze({ ...emptyInventory(), herbs: 4, iron: 3 });
    expect(applyLabyrinthRewardMaterialModifiers(materials, ["scavenger", "herbalist"])).toEqual({
      ...emptyInventory(),
      herbs: 11,
      iron: 6,
    });
    expect(applyLabyrinthRewardMaterialModifiers(materials, ["herbalist"])).toEqual({
      ...emptyInventory(),
      herbs: 7,
      iron: 3,
    });
    expect(applyLabyrinthRewardMaterialModifiers(materials, ["generous"])).toBe(materials);
    expect(materials).toEqual({ ...emptyInventory(), herbs: 4, iron: 3 });
  });
});
