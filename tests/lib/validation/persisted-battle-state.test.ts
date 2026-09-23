import { describe, expect, it } from "vitest";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { scaleByRoomMultiplier } from "@/lib/battle/enemy-turn-traits";
import { cardById, enemyById } from "@/lib/game-data";

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

  it("restores a battle when queued cards are its only card pile", () => {
    const { deck: _, hand: _hand, discard: _discard, exhausted: _exhausted, ...state } = validState();
    const pendingHandCards = [{ ...cardById.slash!, uid: 42 }];
    const restored = PersistedBattleStateSchema.parse({ ...state, pendingHandCards });
    expect(restored.pendingHandCards).toEqual(pendingHandCards);
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

  it("keeps valid cards around malformed battle pile and queued Wish entries", () => {
    const restored = PersistedBattleStateSchema.parse({
      ...validState(),
      deck: [{ id: "slash" }, { id: 42 }, { id: "block" }],
      hand: [null, { id: "slash" }],
      wishOptions: [{ id: "slash" }, null],
      wishQueue: [[{ id: "block" }, { id: 42 }], "junk", [null, { id: "slash" }]],
    });
    expect(restored.deck.map((card) => card.id)).toEqual(["slash", "block"]);
    expect(restored.hand.map((card) => card.id)).toEqual(["slash"]);
    expect(restored.wishOptions?.map((card) => card.id)).toEqual(["slash"]);
    expect(restored.wishQueue.map((queue) => queue.map((card) => card.id))).toEqual([["block"], ["slash"]]);
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

  it("drops a battle with a missing or unknown enemy", () => {
    const { currentEnemy: _, ...state } = validState();
    expect(PersistedBattleStateSchema.safeParse(state).success).toBe(false);
    expect(
      PersistedBattleStateSchema.safeParse({ ...validState(), currentEnemy: { id: "missing-enemy" } }).success,
    ).toBe(false);
  });

  it("restores a known enemy's catalog identity when saved display fields are missing", () => {
    const result = PersistedBattleStateSchema.parse({ ...validState(), currentEnemy: { id: "iron-bear" } });
    expect(result.currentEnemy).toEqual(enemyById["iron-bear"]);
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
      currentEnemy: { id: "skeleton" },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.deck).toEqual([]);
    expect(result.data.mana).toBe(0);
    expect(result.data.gold).toBe(0);
    expect(result.data.turn).toBe(1);
    expect(result.data.turnPhase).toBe("player");
    expect(result.data.currentEnemy).toEqual(enemyById.skeleton);
  });

  it("repairs malformed room scaling and numeric combat records before damage calculation", () => {
    const result = PersistedBattleStateSchema.parse({
      ...validState(),
      roomScalingMultiplier: "broken",
      playerStatuses: { block: "broken", armor: 7, poison: -4 },
      enemyStatuses: { burn: Infinity, poison: 3 },
      playerCC: { stunSkipTurns: "broken", cooldown: 2 },
      enemyCC: { freezeSkipTurns: -1 },
      enemyMitigation: { block: "broken", armor: 5 },
    });
    expect(result.roomScalingMultiplier).toBe(1);
    expect(result.playerStatuses).toMatchObject({ block: 0, armor: 7, poison: 0 });
    expect(result.enemyStatuses).toMatchObject({ burn: 0, poison: 3 });
    expect(result.playerCC).toMatchObject({ stunSkipTurns: 0, cooldown: 2 });
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
    expect(result.enemyMitigation).toMatchObject({ block: 0, armor: 5 });
    expect(Number.isFinite(scaleByRoomMultiplier({ ...result, rng: () => 0 }, 3))).toBe(true);
  });

  it("accepts enemy turnPhase", () => {
    const state = { ...validState(), turnPhase: "enemy" };
    const result = PersistedBattleStateSchema.safeParse(state);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.turnPhase).toBe("enemy");
  });
});
