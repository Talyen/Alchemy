import { describe, expect, it } from "vitest";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";

describe("PersistedBattleStateSchema", () => {
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

  it("accepts a valid battle state and merges defaults", () => {
    const result = PersistedBattleStateSchema.safeParse(validState());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.mana).toBe(4);
    expect(result.data.turnPhase).toBe("player");
    expect(result.data.flags.divineAegisTriggered).toBe(false);
    expect(result.data.playerStatuses.block).toBe(0);
    expect(result.data.playerStatuses.armor).toBe(0);
    expect(result.data.enemyStatuses.burn).toBe(0);
  });

  it("rejects null", () => {
    expect(PersistedBattleStateSchema.safeParse(null).success).toBe(false);
  });

  it("rejects undefined", () => {
    expect(PersistedBattleStateSchema.safeParse(undefined).success).toBe(false);
  });

  it("rejects a string", () => {
    expect(PersistedBattleStateSchema.safeParse("battle").success).toBe(false);
  });

  it("rejects when deck is not an array", () => {
    const state = { ...validState(), deck: "not-array" };
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects when mana is not a number", () => {
    const state = { ...validState(), mana: "four" };
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects when turnPhase is invalid", () => {
    const state = { ...validState(), turnPhase: "idle" };
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects when currentEnemy is missing", () => {
    const { currentEnemy: _, ...state } = validState();
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects when enemyAttackEffects is not an array", () => {
    const state = { ...validState(), enemyAttackEffects: "damage" };
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects when playerStatuses is missing", () => {
    const { playerStatuses: _, ...state } = validState();
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects when discoveredCardIds is not an array", () => {
    const state = { ...validState(), discoveredCardIds: "none" };
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects when difficultyModifiers is not an array", () => {
    const state = { ...validState(), difficultyModifiers: null };
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
  });

  it("accepts enemy turnPhase", () => {
    const state = { ...validState(), turnPhase: "enemy" };
    const result = PersistedBattleStateSchema.safeParse(state);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.turnPhase).toBe("enemy");
  });
});
