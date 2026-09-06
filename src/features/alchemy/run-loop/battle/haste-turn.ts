import { type BattleState, type EndPlayerTurnResolution } from "@/lib/battle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { clearBattleTransition } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { runBattleDraw } from "./draw-sequence";
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
  orch.resetHandTransferUi();
  if (result.combatTexts.length > 0) orch.getPresentation().showCombatTexts(result.combatTexts);
  void runBattleDraw({
    oldHand: companionState.hand,
    newState: result.state,
    applyState: () => {},
    session: sessionNum,
    deps: orch.getDrawSequenceDeps(),
    errorContext: "handle end turn draw sequence",
    onSettled: () => continueAfterHasteDraw(result, sessionNum, battleSession, orch, resolveEndTurn),
  });
}

function continueAfterHasteDraw(
  result: EndPlayerTurnResolution,
  sessionNum: number,
  battleSession: BattleTurnSession,
  orch: TurnOrchestration,
  resolveEndTurn: ResolveEndTurn,
) {
  battleSession.runIfSessionActive(sessionNum, () => {
    const continuation = getBattleContinuation(result.state, result.playerTurnSkipped);
    if (!continuation) dispatchRunSessionCommand((draft) => clearBattleTransition(draft));
    finalizePlayerTurnResume(
      readBattle().battleState,
      result.playerTurnSkipped,
      sessionNum,
      battleSession,
      orch,
      resolveEndTurn,
    );
  });
}
