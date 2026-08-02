import { beforeEach, describe, expect, it } from "vitest";
import { readGameplayState, useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import {
  readActiveRun,
  readBattle,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-session-read-port";

beforeEach(() => {
  useGameplayStateStore.setState(useGameplayStateStore.getInitialState(), true);
});

describe("aggregate read ports", () => {
  it("reads every gameplay lifetime from the authoritative aggregate", () => {
    const root = readGameplayState();
    root.runActions.setRunGold(23);
    root.sessionActions.setHasActiveRun(true);
    root.battleActions.setHasActiveBattle(true);
    root.runProfileActions.setMaterials({ wood: 4, iron: 0, herbs: 0, food: 0, crystal: 0 });
    root.profileActions.setFinishedRunCharacters(["knight"]);

    expect(readActiveRun().runGold).toBe(23);
    expect(readRunSession().hasActiveRun).toBe(true);
    expect(readBattle().hasActiveBattle).toBe(true);
    expect(readRunProfile().materialInventory.wood).toBe(4);
    expect(readGameplayState().profile.finishedRunCharacters).toEqual(["knight"]);
  });

  it("keeps feature-facing imperative reads data-only", () => {
    expect(readActiveRun()).not.toHaveProperty("setRunGold");
    expect(readActiveRun()).not.toHaveProperty("nextRunRandom");
    expect(readRunProfile()).not.toHaveProperty("unlockTalent");
    expect(readRunSession()).not.toHaveProperty("setRewardState");
    expect(readBattle()).not.toHaveProperty("setSyncedBattleState");
  });
});
