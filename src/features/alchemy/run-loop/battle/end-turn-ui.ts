import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/ui-store";
import { isPlayerDefeated } from "@/lib/battle";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import type { createBattleSession } from "./battle-session";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { isBattlePlayInputBusy } from "./autoplay-driver";
import { logBattleError } from "./controller-utils";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import { commitEndTurn, resumePendingBattleTransition } from "./turn-orchestration";
import { playTurnFrames } from "./enemy-phase";

export function createBattleEndTurnUi(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  function handleEndTurn() {
    const currentState = readBattle().battleState;
    const presentation = ctx.getPresentation();
    if (
      isBattleInspectionOpen(useUiStore.getState()) ||
      ctx.screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      isBattlePlayInputBusy({
        cardPlayInProgress: ctx.cardPlayInProgressRef.current,
        cardTransferInProgress: presentation.cardTransferInProgress,
      })
    )
      return;

    // Commit before starting any animation. Failed resolution leaves both gameplay and presentation untouched.
    const result = commitEndTurn();
    ctx.clearAutoEndTurnRef.current?.();
    ctx.cardPlayInProgressRef.current = true;
    session.clearAllBattleTimeouts();
    const sessionNum = ctx.battleSessionRef.current;
    if (result.state.enemyHealth <= 0 || isPlayerDefeated(result.state)) {
      presentation.showCombatTexts(
        result.frames.flatMap(({ turn, companion }) => [...turn.combatTexts, ...(companion?.texts ?? [])]),
      );
      ctx.cardPlayInProgressRef.current = false;
      session.checkBattleEnd(result.state, sessionNum);
      return;
    }
    presentation.setDisplayedBattle(currentState);
    void (async () => {
      try {
        markBattleStage("discard-start");
        try {
          if (!isAnimationDisabled()) await transferDeps.animateDiscardedHand(currentState.hand, sessionNum);
        } catch (error) {
          logBattleError("discard hand animation", error);
        }
        if (!session.isCurrentBattleSession(sessionNum)) return;
        markBattleStage("discard-end");
        await playTurnFrames(
          result.frames,
          sessionNum,
          {
            ...transferDeps.getDrawSequenceDeps(),
            isSessionActive: (id) => ctx.screen === "battle" && session.isCurrentBattleSession(id),
          },
          presentation,
        );
      } catch (error) {
        logBattleError("play resolved turn", error);
      } finally {
        session.runIfSessionActive(sessionNum, () => {
          presentation.setDisplayedBattle(null);
          presentation.resetHandTransferUi();
          ctx.cardPlayInProgressRef.current = false;
          ctx.scheduleAutoEndTurnRef.current?.(readBattle().battleState);
        });
      }
    })();
  }

  function resumePendingBattleTransitionUi() {
    const state = resumePendingBattleTransition(ctx.battleSessionRef.current, session);
    if (state) ctx.scheduleAutoEndTurnRef.current?.(state);
  }

  return { handleEndTurn, resumePendingBattleTransition: resumePendingBattleTransitionUi };
}
