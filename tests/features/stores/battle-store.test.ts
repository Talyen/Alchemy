import { describe, expect, it, beforeEach } from "vitest";
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
  });

  it("initializes hasActiveBattle as false", () => {
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
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
});
