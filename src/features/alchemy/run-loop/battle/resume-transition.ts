import { recoverLegacyEnemyPhase } from "@/lib/battle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  clearBattleTransition,
  commitBattleTransition,
  withDraftWorldBattleRng,
  withRestingWorldBattleRng,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import {
  finalizePlayerTurnResume,
  getBattleContinuation,
  type BattleTurnSession,
  type ResolveEndTurn,
  type TurnOrchestration,
} from "./turn-orchestration-shared";

export function resumePendingBattleTransition(
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
): void {
  if (!battleSession.isCurrentBattleSession(sessionNum)) return;
  const pending = readBattle().pendingBattleTransition;
  if (!pending) return;

  if (pending.kind === "opening-draw") {
    const state = pending.resultState;
    dispatchRunSessionCommand((draft) => commitBattleTransition(draft, state, null));
    orch.resetHandTransferUi();
    if (!battleSession.checkBattleEnd(state, sessionNum)) {
      orch.scheduleAutoEndTurn(state);
    }
    return;
  }

  if (pending.kind === "legacy-enemy-turn") {
    const recovered = dispatchRunSessionCommand((draft) => {
      const next = withRestingWorldBattleRng(
        draft,
        recoverLegacyEnemyPhase(withDraftWorldBattleRng(draft, draft.battle.battleState)),
      );
      commitBattleTransition(draft, next, null);
      return next;
    });
    battleSession.checkBattleEnd(recovered, sessionNum);
    return;
  }

  if (pending.kind === "continue-end-turn") {
    const state = readBattle().battleState;
    dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
    resolveEndTurn(state, sessionNum, battleSession, orch);
    return;
  }

  const state = pending.resultState;
  const continuation = getBattleContinuation(state, pending.playerTurnSkipped);
  dispatchRunSessionCommand((draft) => commitBattleTransition(draft, state, continuation));
  finalizePlayerTurnResume(state, pending.playerTurnSkipped, sessionNum, battleSession, orch, resolveEndTurn);
}
