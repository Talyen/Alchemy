import "../../../../helpers/mock-audio";
import {
  mutateGameplayForTest,
  initializeBattleForTest as initializeActiveBattle,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import { battleSnapshot } from "@/lib/battle";
import { createRunRngState } from "@/lib/rng";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { commitEndTurn } from "@/features/alchemy/run-loop/battle/battle-session";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetRunDomainStore();
  setRunProgress({ characterId: "knight", initialized: true, rng: createRunRngState(() => 0.5) });
  setRunSession({ hasActiveRun: true });
});

function openBattle() {
  const state = makeTestBattleState({ turnPhase: "player", enemyHealth: 30 });
  mutateGameplayForTest((draft) => initializeActiveBattle(draft, state));
}

describe("commitEndTurn", () => {
  it("commits the resolved turn and clears any pending transition", () => {
    openBattle();
    const result = commitEndTurn(createBattleCapabilities(defaultGameSession));
    if (!result) throw new Error("Expected a committed turn");
    expect(result.frames.length).toBeGreaterThan(0);
    expect(readBattle(defaultGameSession).battleState).toEqual(battleSnapshot(result.state));
    expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingBattleTransition");
  });
});
