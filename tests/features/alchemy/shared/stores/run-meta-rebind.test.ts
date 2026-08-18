import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { rebindLiveRunMeta } from "@/features/alchemy/shared/stores/run-meta-rebind";
import {
  getBattleStoreView,
  getRunProgressStoreView,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { defaultBattleState } from "@/lib/battle";

beforeEach(() => {
  resetRunDomainStore();
});

describe("live meta rebind", () => {
  it("recomputes max HP and patches an active battle", () => {
    setRunProgress({
      characterId: "knight",
      runPlayerHealth: 20,
      runMaxHealth: 30,
      runMetaMaxHealth: 30,
    });
    setRunSession({ hasActiveRun: true });
    getBattleStoreView().setHasActiveBattle(true);
    getBattleStoreView().setSyncedBattleState({
      ...defaultBattleState(),
      playerHealth: 20,
      playerMaxHealth: 30,
      gold: 0,
    });

    dispatchRunSessionCommand((draft) => {
      draft.runProfile.effects = { ...draft.runProfile.effects, runMaxHealthBonus: 5 };
      rebindLiveRunMeta(draft);
    });

    expect(getRunProgressStoreView().runMaxHealth).toBe(35);
    expect(getRunProgressStoreView().runPlayerHealth).toBe(20);
    expect(getBattleStoreView().battleState.playerMaxHealth).toBe(35);
  });
});
