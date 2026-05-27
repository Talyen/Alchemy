import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { defaultBattleState } from "@/lib/battle";

function freshStore() {
  useBattleStore.setState(useBattleStore.getInitialState());
}

describe("battle-store initialization", () => {
  it("initializes battleState as a valid BattleState (not null)", () => {
    const state = useBattleStore.getState().battleState;
    expect(state).not.toBeNull();
    expect(typeof state.playerStatuses).toBe("object");
    expect(typeof state.enemyStatuses).toBe("object");
    expect(typeof state.playerStatuses.block).toBe("number");
    expect(typeof state.enemyStatuses.poison).toBe("number");
  });

  it("initializes hasActiveBattle as false", () => {
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
  });

  it("initializes with empty card ghosts", () => {
    expect(useBattleStore.getState().cardGhosts).toEqual([]);
  });

  it("initializes with empty floating combat texts", () => {
    expect(useBattleStore.getState().floatingCombatTexts).toEqual([]);
  });

  it("initializes shaking state as false", () => {
    const s = useBattleStore.getState();
    expect(s.enemyShaking).toBe(false);
    expect(s.playerShaking).toBe(false);
    expect(s.companionShaking).toBe(false);
  });

  it("getPlayerStatusChips with initial state returns empty array (no crash)", async () => {
    const { getPlayerStatusChips, getEnemyStatusChips } = await import("@/features/alchemy/utils/battle");
    const state = useBattleStore.getState().battleState;
    expect(getPlayerStatusChips(state)).toEqual([]);
    expect(getEnemyStatusChips(state)).toEqual([]);
  });

  it("hydrates a persisted active battle", () => {
    const persisted = { ...defaultBattleState(), turn: 4, playerHealth: 9 };

    useBattleStore.getState().initializeActiveBattle(persisted);

    expect(useBattleStore.getState().hasActiveBattle).toBe(true);
    expect(useBattleStore.getState().battleState.turn).toBe(4);
    expect(useBattleStore.getState().battleState.playerHealth).toBe(9);

    useBattleStore.getState().initializeActiveBattle(null);
  });
});

describe("battle-store actions", () => {
  beforeEach(freshStore);

  it("setSyncedBattleState replaces the battle state", () => {
    const modified = { ...useBattleStore.getState().battleState, turn: 7 };
    useBattleStore.getState().setSyncedBattleState(modified);
    expect(useBattleStore.getState().battleState.turn).toBe(7);
  });

  it("setSyncedBattleState accepts an updater function", () => {
    useBattleStore.getState().setSyncedBattleState((prev) => ({ ...prev, turn: prev.turn + 5 }));
    expect(useBattleStore.getState().battleState.turn).toBe(6);
  });

  it("setBattleStartState stores a snapshot", () => {
    const snapshot = { ...defaultBattleState(), turn: 3 };
    useBattleStore.getState().setBattleStartState(snapshot);
    expect(useBattleStore.getState().battleStartState?.turn).toBe(3);
  });

  it("setHasActiveBattle toggles the flag", () => {
    useBattleStore.getState().setHasActiveBattle(true);
    expect(useBattleStore.getState().hasActiveBattle).toBe(true);
    useBattleStore.getState().setHasActiveBattle(false);
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
  });

  it("initializeActiveBattle(null) resets to defaults", () => {
    useBattleStore.getState().initializeActiveBattle({ ...defaultBattleState(), turn: 100 });
    expect(useBattleStore.getState().hasActiveBattle).toBe(true);
    useBattleStore.getState().initializeActiveBattle(null);
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
    expect(useBattleStore.getState().battleStartState).toBeNull();
  });

  it("spawnCardGhost adds a ghost", () => {
    useBattleStore.getState().spawnCardGhost({ card: defaultBattleState().deck[0] ?? null, from: "hand", to: "discard" });
    expect(useBattleStore.getState().cardGhosts).toHaveLength(1);
  });

  it("spawnCardGhost and removeCardGhost round-trip", () => {
    useBattleStore.getState().spawnCardGhost({ card: null, from: "deck", to: "hand" });
    const id = useBattleStore.getState().cardGhosts[0].id;
    useBattleStore.getState().removeCardGhost(id);
    expect(useBattleStore.getState().cardGhosts).toHaveLength(0);
  });

  it("clearCardGhosts empties the ghost list", () => {
    useBattleStore.getState().spawnCardGhost({ card: null, from: "deck", to: "hand" });
    useBattleStore.getState().spawnCardGhost({ card: null, from: "hand", to: "discard" });
    useBattleStore.getState().clearCardGhosts();
    expect(useBattleStore.getState().cardGhosts).toEqual([]);
  });

  it("addRevealedCardKey adds a key", () => {
    useBattleStore.getState().addRevealedCardKey("card-1");
    expect(useBattleStore.getState().revealedCardKeys.has("card-1")).toBe(true);
  });

  it("clearRevealedCardKeys empties the set", () => {
    useBattleStore.getState().addRevealedCardKey("card-1");
    useBattleStore.getState().addRevealedCardKey("card-2");
    useBattleStore.getState().clearRevealedCardKeys();
    expect(useBattleStore.getState().revealedCardKeys.size).toBe(0);
  });

  it("shakeEnemy sets and clears enemyShaking", async () => {
    vi.useFakeTimers();
    useBattleStore.getState().shakeEnemy();
    expect(useBattleStore.getState().enemyShaking).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(useBattleStore.getState().enemyShaking).toBe(false);
    vi.useRealTimers();
  });

  it("shakePlayer sets and clears playerShaking", async () => {
    vi.useFakeTimers();
    useBattleStore.getState().shakePlayer();
    expect(useBattleStore.getState().playerShaking).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(useBattleStore.getState().playerShaking).toBe(false);
    vi.useRealTimers();
  });

  it("hurtPlayer increments playerHurtFlashToken", () => {
    expect(useBattleStore.getState().playerHurtFlashToken).toBe(0);
    useBattleStore.getState().hurtPlayer();
    expect(useBattleStore.getState().playerHurtFlashToken).toBe(1);
    useBattleStore.getState().hurtPlayer();
    expect(useBattleStore.getState().playerHurtFlashToken).toBe(2);
  });

  it("hurtEnemy increments enemyHurtFlashToken", () => {
    expect(useBattleStore.getState().enemyHurtFlashToken).toBe(0);
    useBattleStore.getState().hurtEnemy();
    expect(useBattleStore.getState().enemyHurtFlashToken).toBe(1);
  });
});
