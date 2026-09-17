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

  describe("unmultiplied totals", () => {
    function unmultipliedTotal(
      input: Omit<Parameters<typeof computeVictoryGold>[0], "purseGold" | "goldMultiplier" | "wealthyBonus"> & {
        wealthyBonus?: number;
      },
    ) {
      return computeVictoryGold({
        wealthyBonus: 0,
        ...input,
        purseGold: 0,
        goldMultiplier: 1,
      }).persistedGold;
    }

    it("sums all gold sources", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 15 },
        runBoons: [],
        gold: 10,
        eliteBonus: 3,
        generousBonus: 0,
        wealthyBonus: 12,
        bossBonus: 5,
        talentGoldPerCombat: 2,
      });
      expect(result).toBe(47);
    });

    it("handles zero gold sources", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 0 },
        runBoons: [],
        gold: 0,
        eliteBonus: 0,
        generousBonus: 0,
        bossBonus: 0,
        talentGoldPerCombat: 0,
      });
      expect(result).toBe(0);
    });

    it("includes Smuggler's Map boon gold bonus", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 10 },
        runBoons: ["smugglers-map"],
        gold: 5,
        eliteBonus: 1,
        generousBonus: 0,
        bossBonus: 2,
        talentGoldPerCombat: 1,
      });
      expect(result).toBeGreaterThan(19);
    });

    it("handles nonexistent boon gracefully", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 10 },
        runBoons: ["bad-id"],
        gold: 0,
        eliteBonus: 0,
        generousBonus: 0,
        bossBonus: 0,
        talentGoldPerCombat: 0,
      });
      expect(result).toBe(10);
    });

    it("includes generous bonus by name", () => {
      const result = unmultipliedTotal({
        battleState: { gold: 10 },
        runBoons: [],
        gold: 5,
        eliteBonus: 0,
        generousBonus: 4,
        bossBonus: 0,
        talentGoldPerCombat: 0,
      });
      expect(result).toBe(19);
    });
  });

  describe("labyrinth reward modifier helpers", () => {
    it("exposes reward traits for encounter modes but not campaign", () => {
      const modifiers = ["alchemist", "generous"] as Array<"companion" | "alchemist" | "generous" | "scavenger">;

      expect(getActiveRewardModifiersForContentSystem("labyrinth", modifiers)).toBe(modifiers);
      expect(getActiveRewardModifiersForContentSystem("campaign", modifiers)).toEqual([]);
      expect(getActiveRewardModifiersForContentSystem("wildwood", modifiers)).toBe(modifiers);
    });

    it("computes generous gold bonus from base reward gold", () => {
      expect(getGenerousGoldBonus(["generous"], 11)).toBe(6);
      expect(getGenerousGoldBonus([], 11)).toBe(0);
    });

    it("computes wealthy gold bonus from config", () => {
      expect(getWealthyGoldBonus(["wealthy"])).toBe(LABYRINTH_REWARD_CONFIG.wealthyGoldBonus);
      expect(getWealthyGoldBonus([])).toBe(0);
    });

    it("doubles materials for scavenger without mutating the source inventory", () => {
      const materials = { wood: 1, iron: 2, herbs: 3, food: 4, gems: 5, stone: 6, hide: 7 };
      const result = applyLabyrinthRewardMaterialModifiers(materials, ["scavenger"]);

      expect(result).toEqual({
        ...emptyInventory(),
        wood: 2,
        iron: 4,
        herbs: 6,
        food: 8,
        gems: 10,
        stone: 12,
        hide: 14,
      });
      expect(materials).toEqual({ wood: 1, iron: 2, herbs: 3, food: 4, gems: 5, stone: 6, hide: 7 });
    });

    it("adds herbalist herbs after scavenger doubling", () => {
      const materials = { wood: 1, iron: 2, herbs: 3, food: 4, gems: 5, stone: 0, hide: 0 };
      const result = applyLabyrinthRewardMaterialModifiers(materials, ["scavenger", "herbalist"]);

      expect(result.herbs).toBe(6 + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
      expect(result.wood).toBe(2);
    });

    it("adds herbalist herbs when scavenger is inactive", () => {
      const materials = { wood: 1, iron: 2, herbs: 3, food: 4, gems: 5, stone: 0, hide: 0 };
      const result = applyLabyrinthRewardMaterialModifiers(materials, ["herbalist"]);
      expect(result.herbs).toBe(3 + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
    });

    it("leaves materials unchanged when scavenger is inactive", () => {
      const materials = { wood: 1, iron: 2, herbs: 3, food: 4, gems: 5, stone: 0, hide: 0 };
      expect(applyLabyrinthRewardMaterialModifiers(materials, [])).toBe(materials);
    });

    it("maps reward modifier kinds to reward behavior flags", () => {
      const modifiers = ["companion", "alchemist"] as Array<"companion" | "alchemist" | "generous" | "scavenger">;

      expect(shouldGrantCompanionReward(modifiers)).toBe(true);
      expect(shouldGrantAlchemistReward(modifiers)).toBe(true);
      expect(shouldGrantCompanionReward([])).toBe(false);
      expect(shouldGrantAlchemistReward([])).toBe(false);
    });
  });
});
