import { describe, expect, it } from "vitest";
import { createBattleState } from "@/lib/battle";
import {
  getPlayerStatusChips,
  getEnemyStatusChips,
  getCombatTextColorClass,
  getCombatTextIcon,
} from "@/features/alchemy/shared/utils/battle";
import { keywordIcons } from "@/features/alchemy/shared/config";
import { enemyBestiary } from "@/lib/game-data";
import { makeTestCard } from "../../../../fixtures/battle";

const skeleton = enemyBestiary.find((enemy) => enemy.id === "skeleton")!;

function makeProductionBattleState() {
  return createBattleState({ runDeck: [makeTestCard()], currentEnemy: skeleton });
}

describe("getPlayerStatusChips", () => {
  it("returns empty array when state is null (no crash)", () => {
    expect(getPlayerStatusChips(null)).toEqual([]);
  });

  it("returns empty array when state is undefined (no crash)", () => {
    expect(getPlayerStatusChips(undefined)).toEqual([]);
  });

  it("returns empty array when no statuses are active", () => {
    const state = makeProductionBattleState();
    expect(getPlayerStatusChips(state)).toEqual([]);
  });

  it("returns matching chips for active statuses", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.block = 10;
    state.playerStatuses.burn = 3;
    const chips = getPlayerStatusChips(state);
    expect(chips).toContainEqual({ id: "block", value: 10 });
    expect(chips).toContainEqual({ id: "burn", value: 3 });
    expect(chips).toHaveLength(2);
  });

  it("filters out zero-value statuses", () => {
    const state = makeProductionBattleState();
    state.playerStatuses.block = 0;
    state.playerStatuses.burn = 5;
    const chips = getPlayerStatusChips(state);
    expect(chips).not.toContainEqual({ id: "block", value: 0 });
    expect(chips).toContainEqual({ id: "burn", value: 5 });
  });

  it("returns chips in defined order", () => {
    const state = makeProductionBattleState();
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
    const state = makeProductionBattleState();
    expect(getEnemyStatusChips(state)).toEqual([]);
  });

  it("returns matching chips for active statuses", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.poison = 4;
    state.enemyStatuses.freeze = 1;
    const chips = getEnemyStatusChips(state);
    expect(chips).toContainEqual({ id: "poison", value: 4 });
    expect(chips).toContainEqual({ id: "freeze", value: 1 });
  });

  it("filters out zero-value statuses", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.poison = 0;
    state.enemyStatuses.bleed = 2;
    const chips = getEnemyStatusChips(state);
    expect(chips).not.toContainEqual({ id: "poison", value: 0 });
    expect(chips).toContainEqual({ id: "bleed", value: 2 });
  });

  it("does not expose pending bleed leech healing as a status chip", () => {
    const state = makeProductionBattleState();
    state.enemyStatuses.bleed = 2;
    state.pendingBleedLeechHealing = 4;
    expect(getEnemyStatusChips(state)).toEqual([{ id: "bleed", value: 2 }]);
  });
});

describe("getCombatTextColorClass", () => {
  it("returns red for health damage", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "damage", stat: "health", amount: 5 })).toBe(
      "text-red-400",
    );
  });

  it("returns type color for damage by type", () => {
    expect(getCombatTextColorClass({ target: "enemy", kind: "damage", stat: "burn", amount: 5 })).toBe(
      "text-orange-400",
    );
  });

  it("returns green for heals", () => {
    expect(getCombatTextColorClass({ target: "player", kind: "heal", stat: "health", amount: 5 })).toBe(
      "text-green-400",
    );
  });
});

describe("getCombatTextIcon", () => {
  it("returns HeartPulse for heal", () => {
    const icon = getCombatTextIcon({ target: "player", kind: "heal", stat: "health", amount: 5 });
    expect(icon).toBe(keywordIcons.health);
  });

  it("returns the stat's icon for damage", () => {
    const icon = getCombatTextIcon({ target: "enemy", kind: "damage", stat: "burn", amount: 5 });
    expect(icon).toBe(keywordIcons.burn);
  });
});
