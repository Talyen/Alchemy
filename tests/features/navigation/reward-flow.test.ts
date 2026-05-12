import { describe, expect, it, vi } from "vitest";
import { createEmptyRewardState, createBossRewardState, createCombatRewardState, getVictoryGoldTotal } from "@/features/alchemy/navigation/reward-flow";
import { emptyInventory } from "@/lib/homestead/types";

vi.mock("@/features/alchemy/reward-utils", () => ({
  selectRewardCards: vi.fn(() => [{ id: "mock-card", title: "Mock", descriptionLines: [""], art: "", cost: 1, template: "mechanical" as const, effects: [] }]),
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
    const result = createBossRewardState({ gold: 10, bossBonus: 5, talentGoldPerCombat: 2, materials: emptyInventory() });
    expect(result.rewardType).toBe("trinket");
    expect(result.gold).toBe(17);
  });

  it("handles zero bonuses", () => {
    const result = createBossRewardState({ gold: 0, bossBonus: 0, talentGoldPerCombat: 0, materials: emptyInventory() });
    expect(result.gold).toBe(0);
    expect(result.choices.length).toBeGreaterThan(0);
  });
});

describe("createCombatRewardState", () => {
  const baseState = { currentEnemy: { enemyType: "normal" }, gold: 15 } as const;

  it("offers card rewards when random exceeds trinket chance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = createCombatRewardState({
      battleState: baseState as never,
      runDeck: [], gold: 10, eliteBonus: 3, talentGoldPerCombat: 2,
      materials: emptyInventory(), destinations: ["Campfire"],
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
      runDeck: [], gold: 10, eliteBonus: 5, talentGoldPerCombat: 2,
      materials: emptyInventory(), destinations: [],
    });
    expect(result.rewardType).toBe("trinket");
    vi.restoreAllMocks();
  });

  it("includes destinations in result", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const result = createCombatRewardState({
      battleState: baseState as never,
      runDeck: [], gold: 0, eliteBonus: 0, talentGoldPerCombat: 0,
      materials: emptyInventory(), destinations: ["Normal Combat", "Mystery"],
    });
    expect(result.destinations).toEqual(["Normal Combat", "Mystery"]);
    vi.restoreAllMocks();
  });
});

describe("getVictoryGoldTotal", () => {
  it("sums all gold sources", () => {
    const result = getVictoryGoldTotal({ gold: 15 } as never, [], 10, 3, 5, 2);
    expect(result).toBe(35);
  });

  it("handles zero gold sources", () => {
    const result = getVictoryGoldTotal({ gold: 0 } as never, [], 0, 0, 0, 0);
    expect(result).toBe(0);
  });

  it("includes Smuggler's Map trinket gold bonus", () => {
    const result = getVictoryGoldTotal({ gold: 10 } as never, ["smugglers-map"], 5, 1, 2, 1);
    expect(result).toBeGreaterThan(19);
  });

  it("handles nonexistent trinket gracefully", () => {
    const result = getVictoryGoldTotal({ gold: 10 } as never, ["bad-id"], 0, 0, 0, 0);
    expect(result).toBe(10);
  });
});
