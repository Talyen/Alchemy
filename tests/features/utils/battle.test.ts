import { describe, expect, it } from "vitest";
import { createBattleState } from "@/lib/battle";
import { getPlayerStatusChips, getEnemyStatusChips } from "@/features/alchemy/utils/battle";
import type { BattleCard } from "@/lib/game-data";

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test-card", title: "Test", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
}

describe("getPlayerStatusChips", () => {
  it("returns empty array when state is null (no crash)", () => {
    expect(getPlayerStatusChips(null)).toEqual([]);
  });

  it("returns empty array when state is undefined (no crash)", () => {
    expect(getPlayerStatusChips(undefined)).toEqual([]);
  });

  it("returns empty array when no statuses are active", () => {
    const state = createBattleState([makeCard()], 0);
    expect(getPlayerStatusChips(state)).toEqual([]);
  });

  it("returns matching chips for active statuses", () => {
    const state = createBattleState([makeCard()], 0);
    state.playerStatuses.block = 10;
    state.playerStatuses.burn = 3;
    const chips = getPlayerStatusChips(state);
    expect(chips).toContainEqual({ id: "block", value: 10 });
    expect(chips).toContainEqual({ id: "burn", value: 3 });
    expect(chips).toHaveLength(2);
  });

  it("filters out zero-value statuses", () => {
    const state = createBattleState([makeCard()], 0);
    state.playerStatuses.block = 0;
    state.playerStatuses.burn = 5;
    const chips = getPlayerStatusChips(state);
    expect(chips).not.toContainEqual({ id: "block", value: 0 });
    expect(chips).toContainEqual({ id: "burn", value: 5 });
  });

  it("returns chips in defined order", () => {
    const state = createBattleState([makeCard()], 0);
    state.playerStatuses.burn = 3;
    state.playerStatuses.block = 10;
    state.playerStatuses.stun = 1;
    const ids = getPlayerStatusChips(state).map((c) => c.id);
    expect(ids.indexOf("block")).toBeLessThan(ids.indexOf("burn"));
    expect(ids.indexOf("burn")).toBeLessThan(ids.indexOf("stun"));
  });
});

describe("getEnemyStatusChips", () => {
  it("returns empty array when state is null (no crash)", () => {
    expect(getEnemyStatusChips(null)).toEqual([]);
  });

  it("returns empty array when state is undefined (no crash)", () => {
    expect(getEnemyStatusChips(undefined)).toEqual([]);
  });

  it("returns empty array when no statuses are active", () => {
    const state = createBattleState([makeCard()], 0);
    expect(getEnemyStatusChips(state)).toEqual([]);
  });

  it("returns matching chips for active statuses", () => {
    const state = createBattleState([makeCard()], 0);
    state.enemyStatuses.poison = 4;
    state.enemyStatuses.freeze = 1;
    const chips = getEnemyStatusChips(state);
    expect(chips).toContainEqual({ id: "poison", value: 4 });
    expect(chips).toContainEqual({ id: "freeze", value: 1 });
  });

  it("filters out zero-value statuses", () => {
    const state = createBattleState([makeCard()], 0);
    state.enemyStatuses.poison = 0;
    state.enemyStatuses.bleed = 2;
    const chips = getEnemyStatusChips(state);
    expect(chips).not.toContainEqual({ id: "poison", value: 0 });
    expect(chips).toContainEqual({ id: "bleed", value: 2 });
  });
});

describe("createBattleState", () => {
  it("produces a valid state with playerStatuses and enemyStatuses", () => {
    const state = createBattleState([makeCard()], 0);
    expect(state.playerStatuses).toBeDefined();
    expect(state.enemyStatuses).toBeDefined();
    expect(typeof state.playerStatuses.block).toBe("number");
    expect(typeof state.enemyStatuses.poison).toBe("number");
  });
});
