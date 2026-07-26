import { type BattleState } from "@/lib/battle";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { getBattleSessionStore, type createBattleSession } from "./battle-session";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import type { BattleControllerContext } from "./battle-context";
import { resolveEndTurn, type TurnOrchestrationDeps } from "./turn-orchestration";

export function createBattleEndTurnUi(
  ctx: BattleControllerContext,
  session: ReturnType<typeof createBattleSession>,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
  deps: TurnOrchestrationDeps,
) {
  let hasteDrawInProgress = false;

  function resolveEndTurnHandler(currentState: BattleState, sessionNum: number) {
    resolveEndTurn(currentState, sessionNum, deps);
  }

  async function animateEndTurnThenResolve(currentState: BattleState, sessionNum: number) {
    try {
      if (!isAnimationDisabled()) {
        try {
          await transferDeps.animateDiscardedHand(currentState.hand, sessionNum);
        } catch (err) {
          deps.logBattleError("discard hand animation", err);
        }
      }
      session.runIfSessionActive(sessionNum, () => {
        if (resolveEndTurn(currentState, sessionNum, deps)) {
          hasteDrawInProgress = true;
        }
      });
    } finally {
      session.runIfSessionActive(sessionNum, () => {
        if (!hasteDrawInProgress) deps.resetHandTransferUi();
        ctx.cardPlayInProgressRef.current = false;
      });
    }
  }

  function handleEndTurn() {
    hasteDrawInProgress = false;
    const currentState = getBattleSessionStore().battleState;
    if (
      ctx.screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      ctx.cardPlayInProgressRef.current
    )
      return;
    // Claim single-flight before any await so empty-hand / missing-rect early returns
    // and auto-end timer ticks cannot re-enter resolveEndTurn on the same snapshot.
    ctx.clearAutoEndTurnRef.current?.();
    ctx.cardPlayInProgressRef.current = true;
    session.clearBattleTimeoutsKeepCompanion();
    const sessionNum = ctx.battleSessionRef.current;
    void animateEndTurnThenResolve(currentState, sessionNum).catch((err: unknown) =>
      deps.logBattleError("resolve end turn animation sequence", err),
    );
  }

  return { handleEndTurn, resolveEndTurn: resolveEndTurnHandler };
}
