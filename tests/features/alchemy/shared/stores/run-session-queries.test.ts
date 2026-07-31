import { beforeEach, describe, expect, it } from "vitest";
import {
  createRunSessionStoreSnapshot,
  getActiveRunStoreView,
  getBattleStoreView,
  getRunSessionStoreView,
} from "@/features/alchemy/shared/stores/run-session-queries";
import { readGameplayState, useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";

beforeEach(() => {
  useGameplayStateStore.setState(useGameplayStateStore.getInitialState(), true);
});

describe("canonical run-session queries", () => {
  it("projects every compatibility domain from one aggregate revision", () => {
    const root = readGameplayState();
    root.runActions.setRunGold(23);
    root.sessionActions.setHasActiveRun(true);
    root.battleActions.setHasActiveBattle(true);
    root.runProfileActions.setMaterials({ wood: 4, iron: 0, herbs: 0, food: 0, crystal: 0 });
    root.profileActions.setFinishedRunCharacters(["knight"]);

    const snapshot = createRunSessionStoreSnapshot(readGameplayState());

    expect(snapshot.domain.activeRun.runGold).toBe(23);
    expect(snapshot.transient.hasActiveRun).toBe(true);
    expect(snapshot.battle.hasActiveBattle).toBe(true);
    expect(snapshot.runProfile.materialInventory.wood).toBe(4);
    expect(snapshot.profile.finishedRunCharacters).toEqual(["knight"]);
    expect(snapshot.gear.inventories).toBe(readGameplayState().gear.inventories);
  });

  it("uses the same projection for lifetime-matched imperative views", () => {
    const root = readGameplayState();
    root.runActions.setRunGold(31);
    root.sessionActions.setShopState((previous) => ({ ...previous, cards: [] }));

    const snapshot = createRunSessionStoreSnapshot(readGameplayState());
    expect(getActiveRunStoreView().runGold).toBe(snapshot.domain.activeRun.runGold);
    expect(getRunSessionStoreView().shopState).toBe(snapshot.transient.shopState);
    expect(getBattleStoreView().battleState).toBe(snapshot.battle.battleState);
  });
});
