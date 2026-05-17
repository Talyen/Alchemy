import { describe, expect, it, vi } from "vitest";
import {
  applyLabyrinthRewardMaterialModifiers,
  createEmptyRewardState,
  createBossRewardState,
  createCombatRewardState,
  getActiveRewardModifiersForContentSystem,
  getCompanionCardChoices,
  getGenerousGoldBonus,
  getVictoryGoldTotal,
  shouldForceTrinketReward,
  shouldGrantAlchemistReward,
  shouldGrantCompanionReward,
} from "@/features/alchemy/navigation/reward-flow";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";

vi.mock("@/features/alchemy/reward-utils", () => ({
  selectRewardCards: vi.fn(() => [{ id: "mock-card", title: "Mock", descriptionLines: [""], art: "", cost: 1, effects: [] }]),
  selectRewardTrinkets: vi.fn(() => [{ id: "mock-trinket", title: "Mock Trinket", description: "", art: "" }]),
  REWARD_TRINKET_CHANCE: 0.1,
  REWARD_RANDOM_CHANCE: 0,
}));

describe("createEmptyRewardState", () => {
  it("returns initial state with defaults", () => {
    const result = createEmptyRewardState();
    expect(result.choices).toEqual([]);
    expect(result.gold).toBe(0);
    expect(result.selectedId).toBeNull();
    expect(result.rewardType).toBe("card");
  });

  it("accepts optional destinations", () => {
    const result = createEmptyRewardState(["Campfire"]);
    expect(result.destinations).toEqual(["Campfire"]);
  });
});

describe("createBossRewardState", () => {
  it("creates trinket reward with summed gold", () => {
    const result = createBossRewardState({ gold: 10, bossBonus: 5, talentGoldPerCombat: 2, materials: emptyInventory(), trinketIds: [] });
    expect(result.rewardType).toBe("trinket");
    expect(result.gold).toBe(17);
  });

  it("handles zero bonuses", () => {
    const result = createBossRewardState({ gold: 0, bossBonus: 0, talentGoldPerCombat: 0, materials: emptyInventory(), trinketIds: [] });
    expect(result.gold).toBe(0);
    expect(result.choices.length).toBeGreaterThan(0);
  });

  it("applies goldMultiplier to boss reward gold", () => {
    const result = createBossRewardState({ gold: 10, bossBonus: 5, talentGoldPerCombat: 2, materials: emptyInventory(), trinketIds: [], goldMultiplier: 2 });
    expect(result.gold).toBe(34); // floor((10 + 5 + 2) * 2) = floor(34) = 34
  });

  it("goldMultiplier defaults to 1 for boss rewards", () => {
    const result = createBossRewardState({ gold: 10, bossBonus: 5, talentGoldPerCombat: 2, materials: emptyInventory(), trinketIds: [] });
    expect(result.gold).toBe(17); // 10 + 5 + 2 = 17
  });
});

describe("createCombatRewardState", () => {
  const baseState = { currentEnemy: { enemyType: "normal" }, gold: 15 } as const;

  it("offers card rewards when random exceeds trinket chance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = createCombatRewardState({
      battleState: baseState as never,
      runDeck: [], gold: 10, eliteBonus: 3, generousBonus: 0, talentGoldPerCombat: 2,
      materials: emptyInventory(), destinations: ["Campfire"], trinketIds: [],
    });
    expect(result.rewardType).toBe("card");
    expect(result.gold).toBe(15);
    vi.restoreAllMocks();
  });

  it("high elite trinket chance offers trinkets for elite enemies", () => {
    const eliteState = { currentEnemy: { enemyType: "elite" }, gold: 10 } as const;
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = createCombatRewardState({
      battleState: eliteState as never,
      runDeck: [], gold: 10, eliteBonus: 5, generousBonus: 0, talentGoldPerCombat: 2,
      materials: emptyInventory(), destinations: [], trinketIds: [],
    });
    expect(result.rewardType).toBe("trinket");
    expect(result.gold).toBe(17);
    vi.restoreAllMocks();
  });

  it("includes destinations in result", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const result = createCombatRewardState({
      battleState: baseState as never,
      runDeck: [], gold: 0, eliteBonus: 0, generousBonus: 0, talentGoldPerCombat: 0,
      materials: emptyInventory(), destinations: ["Normal Combat", "Mystery"], trinketIds: [],
    });
    expect(result.destinations).toEqual(["Normal Combat", "Mystery"]);
    vi.restoreAllMocks();
  });

  it("applies goldMultiplier to combat reward gold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const result = createCombatRewardState({
      battleState: baseState as never,
      runDeck: [], gold: 10, eliteBonus: 3, generousBonus: 0, talentGoldPerCombat: 2,
      materials: emptyInventory(), destinations: [], trinketIds: [],
      goldMultiplier: 1.5,
    });
    expect(result.gold).toBe(22); // floor((10 + 3 + 0 + 2) * 1.5) = floor(22.5) = 22
    vi.restoreAllMocks();
  });

  it("goldMultiplier defaults to 1 for combat rewards", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const result = createCombatRewardState({
      battleState: baseState as never,
      runDeck: [], gold: 10, eliteBonus: 3, generousBonus: 0, talentGoldPerCombat: 2,
      materials: emptyInventory(), destinations: [], trinketIds: [],
    });
    expect(result.gold).toBe(15); // 10 + 3 + 0 + 2 = 15
    vi.restoreAllMocks();
  });

  it("trinket-hoarder trait adds +10pp trinket chance", () => {
    const goblinState = { currentEnemy: { enemyType: "normal", traits: [{ id: "trinket-hoarder", title: "Trinket Hoarder", description: "" }] }, gold: 10 } as const;
    // Roll 0.15 — below base (0.1) + hoarder bonus (0.1) = 0.2, so trinket is offered
    vi.spyOn(Math, "random").mockReturnValue(0.15);
    const result = createCombatRewardState({
      battleState: goblinState as never,
      runDeck: [], gold: 10, eliteBonus: 3, generousBonus: 0, talentGoldPerCombat: 2,
      materials: emptyInventory(), destinations: [], trinketIds: [],
    });
    expect(result.rewardType).toBe("trinket");
    vi.restoreAllMocks();
  });
});

describe("getVictoryGoldTotal", () => {
  it("sums all gold sources", () => {
    const result = getVictoryGoldTotal({ battleState: { gold: 15 }, runTrinkets: [], gold: 10, eliteBonus: 3, generousBonus: 0, bossBonus: 5, talentGoldPerCombat: 2 });
    expect(result).toBe(35);
  });

  it("handles zero gold sources", () => {
    const result = getVictoryGoldTotal({ battleState: { gold: 0 }, runTrinkets: [], gold: 0, eliteBonus: 0, generousBonus: 0, bossBonus: 0, talentGoldPerCombat: 0 });
    expect(result).toBe(0);
  });

  it("includes Smuggler's Map trinket gold bonus", () => {
    const result = getVictoryGoldTotal({ battleState: { gold: 10 }, runTrinkets: ["smugglers-map"], gold: 5, eliteBonus: 1, generousBonus: 0, bossBonus: 2, talentGoldPerCombat: 1 });
    expect(result).toBeGreaterThan(19);
  });

  it("handles nonexistent trinket gracefully", () => {
    const result = getVictoryGoldTotal({ battleState: { gold: 10 }, runTrinkets: ["bad-id"], gold: 0, eliteBonus: 0, generousBonus: 0, bossBonus: 0, talentGoldPerCombat: 0 });
    expect(result).toBe(10);
  });

  it("includes generous bonus by name", () => {
    const result = getVictoryGoldTotal({ battleState: { gold: 10 }, runTrinkets: [], gold: 5, eliteBonus: 0, generousBonus: 4, bossBonus: 0, talentGoldPerCombat: 0 });
    expect(result).toBe(19);
  });
});

describe("Labyrinth reward modifier helpers", () => {
  it("only exposes reward modifiers during Labyrinth runs", () => {
    const modifiers: LabyrinthModifierKind[] = ["generous", "collector"];

    expect(getActiveRewardModifiersForContentSystem("labyrinth", modifiers)).toBe(modifiers);
    expect(getActiveRewardModifiersForContentSystem("campaign", modifiers)).toEqual([]);
    expect(getActiveRewardModifiersForContentSystem("wildwood", modifiers)).toEqual([]);
  });

  it("computes generous gold bonus from base reward gold", () => {
    expect(getGenerousGoldBonus(["generous"], 11)).toBe(5);
    expect(getGenerousGoldBonus([], 11)).toBe(0);
  });

  it("doubles materials for scavenger without mutating the source inventory", () => {
    const materials = { wood: 1, iron: 2, herbs: 3, food: 4, crystal: 5 };
    const result = applyLabyrinthRewardMaterialModifiers(materials, ["scavenger"]);

    expect(result).toEqual({ wood: 2, iron: 4, herbs: 6, food: 8, crystal: 10 });
    expect(materials).toEqual({ wood: 1, iron: 2, herbs: 3, food: 4, crystal: 5 });
  });

  it("leaves materials unchanged when scavenger is inactive", () => {
    const materials = { wood: 1, iron: 2, herbs: 3, food: 4, crystal: 5 };
    expect(applyLabyrinthRewardMaterialModifiers(materials, [])).toBe(materials);
  });

  it("maps reward modifier kinds to reward behavior flags", () => {
    const modifiers: LabyrinthModifierKind[] = ["collector", "companion", "alchemist"];

    expect(shouldForceTrinketReward(modifiers)).toBe(true);
    expect(shouldGrantCompanionReward(modifiers)).toBe(true);
    expect(shouldGrantAlchemistReward(modifiers)).toBe(true);
    expect(shouldForceTrinketReward([])).toBe(false);
    expect(shouldGrantCompanionReward([])).toBe(false);
    expect(shouldGrantAlchemistReward([])).toBe(false);
  });
});

describe("getCompanionCardChoices", () => {
  it("returns three unique companion cards", () => {
    const choices = getCompanionCardChoices(() => 0);

    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((card) => card.id)).size).toBe(3);
    expect(choices.every((card) => card.effects.some((effect) => effect.kind === "summon-companion"))).toBe(true);
  });

  it("uses Fisher-Yates ordering with injected rng", () => {
    const choices = getCompanionCardChoices(() => 0).map((card) => card.id);

    expect(choices).toEqual(["lizard-scout-companion", "imp-companion", "frost-whelp-companion"]);
  });
});
