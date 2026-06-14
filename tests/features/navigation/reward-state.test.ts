import { describe, expect, it } from "vitest";
import { createEmptyRewardState, createNextRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { emptyInventory } from "@/lib/homestead/inventory";

describe("createEmptyRewardState", () => {
  it("returns initial state with defaults", () => {
    const result = createEmptyRewardState();
    expect(result.choices).toEqual([]);
    expect(result.gold).toBe(0);
    expect(result.materials).toEqual(emptyInventory());
    expect(result.selectedId).toBeNull();
    expect(result.rewardType).toBe("card");
    expect(result.selectedBossId).toBeNull();
  });

  it("accepts optional destinations", () => {
    const result = createEmptyRewardState(["Campfire", "Mystery"]);
    expect(result.destinations).toEqual(["Campfire", "Mystery"]);
  });
});

describe("createNextRewardState", () => {
  it("clears choices, gold, and selection but keeps destinations and selectedBossId", () => {
    const previous = {
      ...createEmptyRewardState(["Normal Combat", "Campfire"]),
      choices: [{ id: "card-a", title: "A", descriptionLines: [""], art: "", cost: 1, effects: [] }],
      gold: 12,
      selectedId: "card-a",
      rewardType: "boon" as const,
      selectedBossId: "boss-1",
    };

    const next = createNextRewardState(previous);

    expect(next.choices).toEqual([]);
    expect(next.gold).toBe(0);
    expect(next.selectedId).toBeNull();
    expect(next.rewardType).toBe("card");
    expect(next.destinations).toEqual(["Normal Combat", "Campfire"]);
    expect(next.selectedBossId).toBe("boss-1");
    expect(next.materials).toEqual(emptyInventory());
  });
});
