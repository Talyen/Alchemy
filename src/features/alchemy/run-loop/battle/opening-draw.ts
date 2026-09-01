import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { commitBattleTransition } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleTransferDeps } from "./battle-transfer-deps";
import { logBattleError } from "./controller-utils";
import { runHandDrawSequence } from "./draw-sequence";

export function createBattleOpeningDraw(
  ctx: BattleControllerContext,
  transferDeps: ReturnType<typeof createBattleTransferDeps>,
) {
  async function playOpeningDraw() {
    const current = readBattle();
    const pending = current.pendingBattleTransition;
    if (pending?.kind !== "opening-draw") return false;
    const sessionNum = ctx.battleSessionRef.current;

    try {
      const completed = await runHandDrawSequence(
        current.battleState.hand,
        pending.resultState,
        () => dispatchRunSessionCommand((draft) => commitBattleTransition(draft, pending.resultState, null)),
        sessionNum,
        transferDeps.getDrawSequenceDeps(),
      );
      if (completed) ctx.scheduleAutoEndTurnRef.current?.(pending.resultState);
      return completed;
    } catch (err) {
      ctx.getPresentation().resetHandTransferUi();
      logBattleError("draw opening hand", err);
      return false;
    }
  }

  return { playOpeningDraw };
}
