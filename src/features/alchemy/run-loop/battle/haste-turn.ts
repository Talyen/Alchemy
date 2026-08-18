import { type BattleState, type EndPlayerTurnResolution } from "@/lib/battle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { clearBattleTransition, commitBattleTransition } from "@/features/alchemy/shared/stores/run-session-write-port";
import { runHandDrawSequence } from "./draw-sequence";
import {
  getBattleContinuation,
  type BattleTurnSession,
  type ResolveEndTurn,
  type TurnOrchestration,
} from "./turn-orchestration-shared";

export function resolveHasteSkipTurn(
  result: EndPlayerTurnResolution,
  companionState: BattleState,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
) {
  const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
  dispatchRunSessionCommand((draft) => commitBattleTransition(draft, result.state, continuation));
  if (result.combatTexts.length > 0) orch.getPresentation().showCombatTexts(result.combatTexts);
  void Promise.resolve(
    runHandDrawSequence(companionState.hand, result.state, () => undefined, sessionNum, orch.getDrawSequenceDeps()),
  )
    .catch((err: unknown) => orch.logBattleError("handle end turn draw sequence", err))
    .finally(() => continueAfterHasteDraw(result, sessionNum, battleSession, orch, resolveEndTurn));
}

function continueAfterHasteDraw(
  result: EndPlayerTurnResolution,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
) {
  battleSession.runIfSessionActive(sessionNum, () => {
    orch.resetHandTransferUi();
    const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
    if (!continuation) dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
    if (battleSession.checkBattleEnd(result.state, sessionNum)) return;
    if (result.playerTurnSkipped) {
      dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
      resolveEndTurn(result.state, sessionNum, battleSession, orch);
      return;
    }
    orch.scheduleCompanionFollowUp(result.state, sessionNum);
  });
}
