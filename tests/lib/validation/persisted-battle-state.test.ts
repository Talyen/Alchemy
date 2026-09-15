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

  it("repairs a non-array deck to empty instead of discarding the battle", () => {
    const result = PersistedBattleStateSchema.safeParse({ ...validState(), deck: "not-array" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.deck).toEqual([]);
    expect(result.data.mana).toBe(4);
  });

  it("repairs a non-numeric mana to the battle default", () => {
    const result = PersistedBattleStateSchema.safeParse({ ...validState(), mana: "four" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.mana).toBe(0);
    expect(result.data.turnPhase).toBe("player");
  });

  it("repairs an invalid turnPhase to player", () => {
    const result = PersistedBattleStateSchema.safeParse({ ...validState(), turnPhase: "idle" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.turnPhase).toBe("player");
  });

  it("repairs a missing currentEnemy to the placeholder default", () => {
    const { currentEnemy: _, ...state } = validState();
    const result = PersistedBattleStateSchema.safeParse(state);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.currentEnemy.id).toBe("skeleton");
    expect(result.data.currentEnemy.abilityIds).toEqual(["slash", "bash", "block"]);
  });

  it("repairs invalid last-ability history without discarding the battle", () => {
    const result = PersistedBattleStateSchema.parse({ ...validState(), lastEnemyAbilityId: "missing-card" });
    expect(result.lastEnemyAbilityId).toBeNull();
    expect(result.currentEnemy.abilityIds).toEqual(["slash", "bash", "block"]);
  });

  it("repairs missing playerStatuses to zeroed records", () => {
    const { playerStatuses: _, ...state } = validState();
    const result = PersistedBattleStateSchema.safeParse(state);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.playerStatuses.block).toBe(0);
    expect(result.data.playerHealth).toBe(30);
  });

  it("repairs non-array discovery and modifier lists to empty", () => {
    const result = PersistedBattleStateSchema.safeParse({
      ...validState(),
      discoveredCardIds: "none",
      difficultyModifiers: null,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.discoveredCardIds).toEqual([]);
    expect(result.data.difficultyModifiers).toEqual([]);
  });

  it("rejects a battle fragment with no card piles", () => {
    expect(PersistedBattleStateSchema.safeParse({ turn: 2 }).success).toBe(false);
    expect(PersistedBattleStateSchema.safeParse({ turn: 2, deck: "junk" }).success).toBe(false);
  });

  it("keeps a battle whose piles are present but empty", () => {
    const result = PersistedBattleStateSchema.safeParse({
      ...validState(),
      deck: [],
      hand: [],
      discard: [],
      exhausted: [],
    });
    expect(result.success).toBe(true);
  });

  it("repairs several corrupt scalars at once without discarding the battle", () => {
    const result = PersistedBattleStateSchema.safeParse({
      ...validState(),
      deck: "junk",
      mana: "four",
      gold: -5,
      turn: 0,
      turnPhase: "idle",
      currentEnemy: null,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.deck).toEqual([]);
    expect(result.data.mana).toBe(0);
    expect(result.data.gold).toBe(0);
    expect(result.data.turn).toBe(1);
    expect(result.data.turnPhase).toBe("player");
    expect(result.data.currentEnemy.id).toBe("skeleton");
  });

  it("accepts enemy turnPhase", () => {
    const state = { ...validState(), turnPhase: "enemy" };
    const result = PersistedBattleStateSchema.safeParse(state);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.turnPhase).toBe("enemy");
  });
});
