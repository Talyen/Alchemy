import {
  mutateGameplayForTest,
  setBattleActiveForTest as setHasActiveBattle,
  replaceBattleForTest as setSyncedBattleState,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import { rebindLiveRunMeta } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { defaultBattleState } from "@/lib/battle";
import { defaultGameSession } from "@/app/application-session";

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
    mutateGameplayForTest((draft) => {
      setHasActiveBattle(draft, true);
      setSyncedBattleState(draft, {
        ...defaultBattleState(),
        playerHealth: 20,
        playerMaxHealth: 30,
        gold: 0,
      });
    });

    mutateGameplayForTest((draft) => {
      draft.runProfile.effects = { ...draft.runProfile.effects, runMaxHealthBonus: 5 };
      rebindLiveRunMeta(draft);
    });

    expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(35);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(20);
    expect(readBattle(defaultGameSession).battleState.playerMaxHealth).toBe(35);
  });
});
