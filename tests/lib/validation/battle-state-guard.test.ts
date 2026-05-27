import { describe, expect, it } from "vitest";
import { isPersistedBattleState } from "@/lib/validation/battle-state-guard";

describe("isPersistedBattleState", () => {
  function validState(): Record<string, unknown> {
    return {
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
      mana: 4,
      maxMana: 4,
      gold: 10,
      turn: 1,
      turnPhase: "player",
      playerHealth: 30,
      playerMaxHealth: 30,
      enemyHealth: 20,
      enemyMaxHealth: 20,
      currentEnemy: { id: "skeleton" },
      enemyAttackEffects: [],
      playerStatuses: {},
      enemyStatuses: {},
      flags: {},
      discoveredCardIds: [],
      difficultyModifiers: [],
    };
  }

  it("accepts a valid battle state", () => {
    expect(isPersistedBattleState(validState())).toBe(true);
  });

  it("rejects null", () => {
    expect(isPersistedBattleState(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isPersistedBattleState(undefined)).toBe(false);
  });

  it("rejects a string", () => {
    expect(isPersistedBattleState("battle")).toBe(false);
  });

  it("rejects when deck is not an array", () => {
    const state = { ...validState(), deck: "not-array" };
    expect(isPersistedBattleState(state)).toBe(false);
  });

  it("rejects when mana is not a number", () => {
    const state = { ...validState(), mana: "four" };
    expect(isPersistedBattleState(state)).toBe(false);
  });

  it("rejects when turnPhase is invalid", () => {
    const state = { ...validState(), turnPhase: "idle" };
    expect(isPersistedBattleState(state)).toBe(false);
  });

  it("rejects when currentEnemy is missing", () => {
    const { currentEnemy: _, ...state } = validState();
    expect(isPersistedBattleState(state)).toBe(false);
  });

  it("rejects when enemyAttackEffects is not an array", () => {
    const state = { ...validState(), enemyAttackEffects: "damage" };
    expect(isPersistedBattleState(state)).toBe(false);
  });

  it("rejects when playerStatuses is missing", () => {
    const { playerStatuses: _, ...state } = validState();
    expect(isPersistedBattleState(state)).toBe(false);
  });

  it("rejects when discoveredCardIds is not an array", () => {
    const state = { ...validState(), discoveredCardIds: "none" };
    expect(isPersistedBattleState(state)).toBe(false);
  });

  it("rejects when difficultyModifiers is not an array", () => {
    const state = { ...validState(), difficultyModifiers: null };
    expect(isPersistedBattleState(state)).toBe(false);
  });

  it("accepts enemy turnPhase", () => {
    const state = { ...validState(), turnPhase: "enemy" };
    expect(isPersistedBattleState(state)).toBe(true);
  });
});
