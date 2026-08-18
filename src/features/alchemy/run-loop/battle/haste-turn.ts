import { type BattleState, type EndPlayerTurnResolution } from "@/lib/battle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { clearBattleTransition, commitBattleTransition } from "@/features/alchemy/shared/stores/run-session-write-port";
import { runHandDrawSequence } from "./draw-sequence";
import {
  finalizePlayerTurnResume,
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
  if (result.combatTexts.length > 0) orch.getPresentation().showCombatTexts(result.combatTexts);
  let committedDuringDraw = false;
  void Promise.resolve(
    runHandDrawSequence(
      companionState.hand,
      result.state,
      () => {
        dispatchRunSessionCommand((draft) => commitBattleTransition(draft, result.state, continuation));
        committedDuringDraw = true;
      },
      sessionNum,
      orch.getDrawSequenceDeps(),
    ),
  )
    .catch((err: unknown) => orch.logBattleError("handle end turn draw sequence", err))
    .finally(() =>
      continueAfterHasteDraw(result, sessionNum, battleSession, orch, resolveEndTurn, committedDuringDraw),
    );
}

function continueAfterHasteDraw(
  result: EndPlayerTurnResolution,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
  committedDuringDraw: boolean,
) {
  battleSession.runIfSessionActive(sessionNum, () => {
    orch.resetHandTransferUi();
    const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
    if (!committedDuringDraw) {
      dispatchRunSessionCommand((draft) => commitBattleTransition(draft, result.state, continuation));
    }
    if (!continuation) dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
    finalizePlayerTurnResume(result.state, result.playerTurnSkipped, sessionNum, battleSession, orch, resolveEndTurn);
  });
}
