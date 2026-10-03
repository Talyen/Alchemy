import { describe, expect, it } from "vitest";
import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import {
  applyLabyrinthRewardMaterialModifiers,
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

  it("exposes reward traits only for encounter modes", () => {
    const modifiers = ["generous"] as const;
    const offered = [...modifiers];
    expect(getActiveRewardModifiersForContentSystem(CONTENT_SYSTEMS.CAMPAIGN, offered)).toEqual([]);
    expect(getActiveRewardModifiersForContentSystem(CONTENT_SYSTEMS.LABYRINTH, offered)).toBe(offered);
    expect(getActiveRewardModifiersForContentSystem(CONTENT_SYSTEMS.WILDWOOD, offered)).toBe(offered);
  });
});

describe("reward math", () => {
  it("scales the generous bonus with gold and rounds", () => {
    expect(getGenerousGoldBonus(["generous"], 11)).toBe(6);
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
    const combined = applyLabyrinthRewardMaterialModifiers(materials, ["scavenger", "herbalist"]);
    expect(combined.herbs).toBe(8 + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
    expect(materials).toEqual({ ...emptyInventory(), herbs: 4, iron: 3 });
    const herbalist = applyLabyrinthRewardMaterialModifiers(materials, ["herbalist"]);
    expect(herbalist.herbs).toBe(4 + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
    expect(herbalist.iron).toBe(3);
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

  it("never earns negative gold when battle gold is below the purse", () => {
    expect(
      computeVictoryGold({
        battleState: { gold: 4 },
        purseGold: 10,
        runBoons: [],
        gold: 0,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 0,
        talentGoldPerCombat: 0,
        goldMultiplier: 1,
      }),
    ).toEqual({ earnedBeforeMultiplier: 0, persistedGold: 10 });
  });

  it("applies the gold multiplier to earned gold only", () => {
    const result = computeVictoryGold({
      battleState: { gold: 20 },
      purseGold: 10,
      runBoons: [],
      gold: 15,
      eliteBonus: 0,
      generousBonus: 0,
      wealthyBonus: 0,
      bossBonus: 0,
      talentGoldPerCombat: 0,
      goldMultiplier: 2,
    });
    expect(result.earnedBeforeMultiplier).toBe(25);
    expect(result.persistedGold).toBe(10 + Math.round(25 * 2));
  });

  it("includes every bonus before multiplying earnings, while preserving the existing purse", () => {
    expect(
      computeVictoryGold({
        battleState: { gold: 65 },
        purseGold: 50,
        runBoons: ["smugglers-map"],
        gold: 10,
        eliteBonus: 3,
        generousBonus: 4,
        wealthyBonus: 12,
        bossBonus: 5,
        talentGoldPerCombat: 2,
        goldMultiplier: 1.5,
      }),
    ).toEqual({ earnedBeforeMultiplier: 53, persistedGold: 130 });
  });
});
