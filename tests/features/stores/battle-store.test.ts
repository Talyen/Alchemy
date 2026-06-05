import { describe, expect, it, beforeEach } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import {
  getBattleStoreView,
  resetRunBattleSlice,
} from "../../helpers/run-domain-store-test";

function freshStore() {
  resetRunBattleSlice();
}

describe("battle-store initialization", () => {
  it("initializes battleState as a valid BattleState (not null)", () => {
    const state = getBattleStoreView().battleState;
    expect(state).not.toBeNull();
    expect(typeof state.playerStatuses).toBe("object");
    expect(typeof state.enemyStatuses).toBe("object");
  });

  it("initializes hasActiveBattle as false", () => {
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("hydrates a persisted active battle", () => {
    const persisted = { ...defaultBattleState(), turn: 4, playerHealth: 9 };

    getBattleStoreView().initializeActiveBattle(persisted);

    expect(getBattleStoreView().hasActiveBattle).toBe(true);
    expect(getBattleStoreView().battleState.turn).toBe(4);
    expect(getBattleStoreView().battleState.playerHealth).toBe(9);

    getBattleStoreView().initializeActiveBattle(null);
  });
});

describe("battle-store actions", () => {
  beforeEach(freshStore);

  it("setSyncedBattleState replaces the battle state", () => {
    const modified = { ...getBattleStoreView().battleState, turn: 7 };
    getBattleStoreView().setSyncedBattleState(modified);
    expect(getBattleStoreView().battleState.turn).toBe(7);
  });

  it("setSyncedBattleState accepts an updater function", () => {
    getBattleStoreView().setSyncedBattleState((prev) => ({ ...prev, turn: prev.turn + 5 }));
    expect(getBattleStoreView().battleState.turn).toBe(6);
  });

  it("setBattleStartState stores a snapshot", () => {
    const snapshot = { ...defaultBattleState(), turn: 3 };
    getBattleStoreView().setBattleStartState(snapshot);
    expect(getBattleStoreView().battleStartState?.turn).toBe(3);
  });

  it("setHasActiveBattle toggles the flag", () => {
    getBattleStoreView().setHasActiveBattle(true);
    expect(getBattleStoreView().hasActiveBattle).toBe(true);
    getBattleStoreView().setHasActiveBattle(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("initializeActiveBattle(null) resets to defaults", () => {
    getBattleStoreView().initializeActiveBattle({ ...defaultBattleState(), turn: 100 });
    expect(getBattleStoreView().hasActiveBattle).toBe(true);
    getBattleStoreView().initializeActiveBattle(null);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
    expect(getBattleStoreView().battleStartState).toBeNull();
  });
});
