import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it } from "vitest";
import { battleSnapshot } from "@/lib/battle";
import { createRunRngState } from "@/lib/rng";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { initializeActiveBattle } from "@/features/alchemy/shared/stores/write/run-battle";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { commitEndTurn } from "@/features/alchemy/run-loop/battle/battle-session";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunDomainStore();
  setRunProgress({ characterId: "knight", initialized: true, rng: createRunRngState(() => 0.5) });
  setRunSession({ hasActiveRun: true });
});

function openBattle() {
  const state = makeTestBattleState({ turnPhase: "player", enemyHealth: 30 });
  dispatchRunSessionCommand((draft) => initializeActiveBattle(draft, state));
}

describe("commitEndTurn", () => {
  it("commits the resolved turn and clears any pending transition", () => {
    openBattle();
    const result = commitEndTurn();
    expect(result.frames.length).toBeGreaterThan(0);
    expect(readBattle().battleState).toEqual(battleSnapshot(result.state));
    expect(readBattle()).not.toHaveProperty("pendingBattleTransition");
  });
});
