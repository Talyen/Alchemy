import { describe, expect, it } from "vitest";
import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import {
  applyLabyrinthRewardMaterialModifiers,
  computeRewardGold,
  computeVictoryGold,
  getActiveRewardModifiersForContentSystem,
  getGenerousGoldBonus,
  getWealthyGoldBonus,
  getWellProvisionedHealing,
  shouldGrantAlchemistReward,
  shouldGrantCompanionReward,
} from "@/features/alchemy/run-loop/navigation/reward-math";

describe("reward predicates", () => {
  it("grants companion rewards for companion-family traits only", () => {
    expect(shouldGrantCompanionReward(["companion"])).toBe(true);
    expect(shouldGrantCompanionReward(["fletched"])).toBe(true);
    expect(shouldGrantCompanionReward(["wishkeeper"])).toBe(true);
    expect(shouldGrantCompanionReward(["kindred-spoils"])).toBe(true);
    expect(shouldGrantCompanionReward([])).toBe(false);
    expect(shouldGrantCompanionReward(["generous"])).toBe(false);
  });

  it("grants the alchemist bonus only with the alchemist trait", () => {
    expect(shouldGrantAlchemistReward(["alchemist"])).toBe(true);
    expect(shouldGrantAlchemistReward([])).toBe(false);
    expect(shouldGrantAlchemistReward(["companion"])).toBe(false);
  });

  it("ignores labyrinth modifiers outside labyrinth-family content", () => {
    expect(getActiveRewardModifiersForContentSystem(CONTENT_SYSTEMS.CAMPAIGN, ["generous"])).toEqual([]);
    expect(getActiveRewardModifiersForContentSystem(CONTENT_SYSTEMS.LABYRINTH, ["generous"])).toEqual(["generous"]);
  });
});

describe("reward math", () => {
  it("scales the generous bonus with gold and rounds", () => {
    expect(getGenerousGoldBonus([], 100)).toBe(0);
    expect(getGenerousGoldBonus(["generous"], 100)).toBe(
      Math.round(100 * LABYRINTH_REWARD_CONFIG.generousGoldBonusFraction),
    );
  });

  it("pays flat wealthy and well-provisioned bonuses with a 1-HP floor", () => {
    expect(getWealthyGoldBonus([])).toBe(0);
    expect(getWealthyGoldBonus(["wealthy"])).toBe(LABYRINTH_REWARD_CONFIG.wealthyGoldBonus);
    expect(getWellProvisionedHealing([], 100)).toBe(0);
    expect(getWellProvisionedHealing(["wellProvisioned"], 100)).toBe(
      Math.max(1, Math.round(100 * LABYRINTH_REWARD_CONFIG.wellProvisionedHealFraction)),
    );
    expect(getWellProvisionedHealing(["wellProvisioned"], 1)).toBe(1);
  });

  it("leaves materials untouched without matching traits", () => {
    const materials = { ...emptyInventory(), herbs: 4 };
    expect(applyLabyrinthRewardMaterialModifiers(materials, [])).toBe(materials);
    expect(applyLabyrinthRewardMaterialModifiers(materials, ["generous"])).toBe(materials);
  });

  it("multiplies scavenger materials and adds herbalist herbs", () => {
    const materials = { ...emptyInventory(), herbs: 4, iron: 3 };
    const scavenged = applyLabyrinthRewardMaterialModifiers(materials, ["scavenger"]);
    expect(scavenged.herbs).toBe(Math.round(4 * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier));
    expect(scavenged.iron).toBe(Math.round(3 * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier));
    const herbalist = applyLabyrinthRewardMaterialModifiers(materials, ["herbalist"]);
    expect(herbalist.herbs).toBe(4 + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
    expect(herbalist.iron).toBe(3);
  });

  it("applies the gold multiplier to the summed reward gold", () => {
    const input = {
      baseGold: 10,
      bonusGold: 2,
      generousBonus: 3,
      wealthyBonus: 5,
      talentGoldPerCombat: 1,
      trinketIds: [],
      goldMultiplier: 2,
    };
    expect(computeRewardGold({ ...input, goldMultiplier: 1 })).toBe(21);
    expect(computeRewardGold(input)).toBe(42);
    expect(computeRewardGold({ ...input, inCombatGold: 5, goldMultiplier: 1 })).toBe(26);
  });

  it("settles victory gold against the purse", () => {
    const base = {
      purseGold: 50,
      runBoons: [],
      gold: 0,
      eliteBonus: 0,
      generousBonus: 0,
      wealthyBonus: 0,
      bossBonus: 0,
      talentGoldPerCombat: 0,
      goldMultiplier: 1,
    };
    expect(computeVictoryGold({ ...base, battleState: { gold: 50 } })).toEqual({
      earnedBeforeMultiplier: 0,
      persistedGold: 50,
    });
    expect(computeVictoryGold({ ...base, battleState: { gold: 65 }, gold: 5 })).toEqual({
      earnedBeforeMultiplier: 20,
      persistedGold: 70,
    });
  });
});
