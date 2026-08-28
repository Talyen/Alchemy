import { type BattleState } from "@/lib/battle";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { type createBattleSession } from "./battle-session";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { isBattlePlayInputBusy } from "./autoplay-driver";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import {
  createTurnOrchestration,
  resolveEndTurn,
  resumePendingBattleTransition as resumePendingBattleTransitionState,
} from "./turn-orchestration";

export function createBattleEndTurnUi(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  const orch = createTurnOrchestration(ctx, session, transferDeps);
  let hasteDrawInProgress = false;

  function resolveEndTurnHandler(currentState: BattleState, sessionNum: number) {
    resolveEndTurn(currentState, sessionNum, session, orch);
  }

  async function animateEndTurnThenResolve(currentState: BattleState, sessionNum: number) {
    try {
      markBattleStage("discard-start");
      try {
        if (!isAnimationDisabled()) {
          await transferDeps.animateDiscardedHand(currentState.hand, sessionNum);
        }
      } catch (err) {
        orch.logBattleError("discard hand animation", err);
      } finally {
        markBattleStage("discard-end");
      }
      session.runIfSessionActive(sessionNum, () => {
        if (resolveEndTurn(currentState, sessionNum, session, orch)) {
          hasteDrawInProgress = true;
        }
      });
    } finally {
      session.runIfSessionActive(sessionNum, () => {
        if (!hasteDrawInProgress) orch.resetHandTransferUi();
        ctx.cardPlayInProgressRef.current = false;
      });
    }
  }

  function handleEndTurn() {
    hasteDrawInProgress = false;
    const currentState = readBattle().battleState;
    if (
      ctx.screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      isBattlePlayInputBusy({
        cardPlayInProgress: ctx.cardPlayInProgressRef.current,
        cardTransferInProgress: ctx.getPresentation().cardTransferInProgress,
      })
    )
      return;

    ctx.clearAutoEndTurnRef.current?.();
    ctx.cardPlayInProgressRef.current = true;
    session.clearBattleTimeoutsKeepCompanion();
    const sessionNum = ctx.battleSessionRef.current;
    void animateEndTurnThenResolve(currentState, sessionNum).catch((err: unknown) =>
      orch.logBattleError("resolve end turn animation sequence", err),
    );
  }

  function resumePendingBattleTransition() {
    resumePendingBattleTransitionState(ctx.battleSessionRef.current, session, orch);
  }

  return { handleEndTurn, resolveEndTurn: resolveEndTurnHandler, resumePendingBattleTransition };
}
