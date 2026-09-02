import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { commitBattleTransition } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import { runBattleDraw } from "./draw-sequence";

export function createBattleOpeningDraw(
  ctx: BattleControllerContext,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  async function playOpeningDraw() {
    const current = readBattle();
    const pending = current.pendingBattleTransition;
    if (pending?.kind !== "opening-draw") return false;
    const sessionNum = ctx.battleSessionRef.current;

    const completed = await runBattleDraw({
      oldHand: current.battleState.hand,
      newState: pending.resultState,
      applyState: () => dispatchRunSessionCommand((draft) => commitBattleTransition(draft, pending.resultState, null)),
      session: sessionNum,
      deps: transferDeps.getDrawSequenceDeps(),
      errorContext: "draw opening hand",
    });
    if (!completed) ctx.getPresentation().resetHandTransferUi();
    else ctx.scheduleAutoEndTurnRef.current?.(pending.resultState);
    return completed;
  }

  return { playOpeningDraw };
}
