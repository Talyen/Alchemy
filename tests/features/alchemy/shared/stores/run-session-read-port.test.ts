import { beforeEach, describe, expect, it } from "vitest";
import { readGameplayState, useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setRunGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import { setHasActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  setFinishedRunCharacters,
  setMaterials as setRunProfileMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
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
    dispatchRunSessionCommand((draft) => {
      setRunGold(draft, 23);
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
      setRunProfileMaterials(draft, { wood: 4, iron: 0, herbs: 0, food: 0, crystal: 0 });
      setFinishedRunCharacters(draft, ["knight"]);
    });

    expect(readRunProfile().gold).toBe(23);
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
