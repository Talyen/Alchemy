import { describe, expect, it } from "vitest";
import {
  createBossRewardState,
  createCombatRewardState,
  createWildwoodRewardState,
} from "@/features/alchemy/run-loop/navigation/reward-flow";
import { emptyInventory } from "@/lib/homestead/inventory";
import { getStartingDeck, trinketLibrary } from "@/lib/game-data";
import { gearDefinitions, uniqueItemList } from "@/lib/gear";
import { createSeededRng } from "@/lib/rng";
import type { RewardState } from "@/lib/active-run-session";

const lootProgress = { depth: 24, highestCompletedDifficulty: null };
const input = {
  lootProgress,
  gold: 10,
  bossBonus: 5,
  eliteBonus: 3,
  generousBonus: 0,
  wealthyBonus: 0,
  talentGoldPerCombat: 2,
  materials: { ...emptyInventory(), wood: 2 },
  trinketIds: [],
  runDeck: getStartingDeck("knight"),
  destinations: ["Campfire" as const],
  battleState: { currentEnemy: { enemyType: "normal" } } as never,
};

function premiums(reward: RewardState): string[] {
  return reward.rewardType === "trinket"
    ? ["trinket"]
    : reward.rewardType === "gear"
      ? reward.choices
          .map((choice) => gearDefinitions[choice.definitionId].rarity)
          .filter((rarity): rarity is "astral" | "unique" => rarity === "astral" || rarity === "unique")
      : [];
}

describe("progressive reward selection", () => {
  it("preserves reward payloads, grouped choices, and independently rolled Gear", () => {
    const types = new Set<string>();
    let mixedGear = false;
    for (let seed = 1; seed <= 100; seed += 1) {
      const result = createCombatRewardState({ ...input, rng: createSeededRng(seed), goldMultiplier: 1.5 });
      types.add(result.rewardType);
      expect(result.gold).toBe(23);
      expect(result.materials).toEqual(input.materials);
      expect(result.destinations).toEqual(input.destinations);
      expect(result.choices).toHaveLength(3);
      if (result.rewardType === "gear") {
        const definitions = result.choices.map((choice) => gearDefinitions[choice.definitionId]);
        expect(new Set(definitions.map((definition) => definition.baseItemId)).size).toBe(3);
        mixedGear ||= new Set(definitions.map((definition) => definition.rarity)).size > 1;
      }
    }
    expect(types).toEqual(new Set(["card", "gear", "boon", "trinket"]));
    expect(mixedGear).toBe(true);
    const boss = createBossRewardState({ ...input, rng: () => 0.1, goldMultiplier: 2 });
    expect(boss.gold).toBe(34);
    expect(boss.materials).toEqual(input.materials);
  });

  it.each([1, 3, 7, 11, 24])("uses the same premium eligibility at depth %s in every combat mode", (depth) => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const progress = { depth, highestCompletedDifficulty: "difficulty-3" as const };
      const rewards = [
        createCombatRewardState({
          ...input,
          lootProgress: progress,
          rng: createSeededRng(seed),
          gearAstralChanceBonus: 1,
        }),
        createBossRewardState({ ...input, lootProgress: progress, rng: createSeededRng(seed) }),
        createWildwoodRewardState(input.runDeck, createSeededRng(seed), progress),
      ];
      for (const reward of rewards) {
        const offered = premiums(reward);
        if (depth < 4) expect(offered).toEqual([]);
        if (depth < 8) expect(offered).not.toContain("trinket");
        if (depth < 12) expect(offered).not.toContain("unique");
        expect(reward.choices).toHaveLength(3);
      }
    }
  });

  it("excludes collected items before sampling and fills a screen when the last Unique is consumed", () => {
    const ownedUniqueIds = new Set(uniqueItemList.slice(1).map((unique) => unique.id));
    const ownedTrinketIds = trinketLibrary.map((entry) => entry.id);
    const result = createBossRewardState({ ...input, ownedUniqueIds, ownedTrinketIds, rng: () => 0.99 });
    expect(result.rewardType).toBe("gear");
    if (result.rewardType !== "gear") throw new Error("expected gear");
    expect(result.choices.map((choice) => gearDefinitions[choice.definitionId].rarity)).toEqual([
      "unique",
      "astral",
      "astral",
    ]);
    expect(result.choices.every((choice) => !ownedUniqueIds.has(choice.definitionId))).toBe(true);
    expect(new Set(result.choices.map((choice) => gearDefinitions[choice.definitionId].baseItemId)).size).toBe(3);
  });

  it("keeps Boons available early and removes exhausted Boon groups without empty rewards", () => {
    const early = { depth: 1, highestCompletedDifficulty: null };
    const boon = createWildwoodRewardState(input.runDeck, () => 0.99, early);
    expect(boon.rewardType).toBe("boon");
    const exhausted = createWildwoodRewardState(
      input.runDeck,
      () => 0,
      early,
      0,
      trinketLibrary.map((entry) => entry.id),
    );
    expect(exhausted.rewardType).toBe("card");
    expect(exhausted.choices).toHaveLength(3);
  });
});
