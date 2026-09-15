import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it } from "vitest";
import { battleSnapshot } from "@/lib/battle";
import { createRunRngState } from "@/lib/rng";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { initializeActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { commitEndTurn, resumePendingBattleTransition } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { makeBattleTurnSession } from "./turn-orchestration-fixture";

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
    expect(readBattle().pendingBattleTransition).toBeNull();
  });
});

describe("resumePendingBattleTransition", () => {
  it("returns null when no transition is pending", () => {
    openBattle();
    const session = makeBattleTurnSession();
    expect(resumePendingBattleTransition(1, session)).toBeNull();
    expect(session.checkBattleEnd).not.toHaveBeenCalled();
  });

  it("returns null for a stale session without consuming anything", () => {
    openBattle();
    const session = makeBattleTurnSession({ isCurrentBattleSession: () => false });
    expect(resumePendingBattleTransition(7, session)).toBeNull();
    expect(session.checkBattleEnd).not.toHaveBeenCalled();
  });

  it("consumes an enemy-turn pending transition exactly once", () => {
    const state = makeTestBattleState({ turnPhase: "player", enemyHealth: 30 });
    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, state, {
        kind: "enemy-turn",
        resultState: battleSnapshot(state),
        playerTurnSkipped: false,
      }),
    );
    const session = makeBattleTurnSession();
    const resumed = resumePendingBattleTransition(1, session);
    expect(resumed).not.toBeNull();
    expect(readBattle().pendingBattleTransition).toBeNull();
    expect(session.checkBattleEnd).toHaveBeenCalledTimes(1);
    expect(resumePendingBattleTransition(1, session)).toBeNull();
    expect(session.checkBattleEnd).toHaveBeenCalledTimes(1);
  });
});
