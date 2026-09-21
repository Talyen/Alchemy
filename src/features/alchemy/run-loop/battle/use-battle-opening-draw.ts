import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect } from "react";
import type { BattleControllerContext } from "./battle-context";
import { useBattlePresentationStore, type BattlePresentationPort } from "./battle-presentation-store";
import { runBattleDraw, type createBattleTransferDeps } from "./draw-sequence";

export interface BattleOpeningDrawContext {
  playback: Pick<BattleControllerContext["playback"], "id" | "completeAction" | "scheduleAutoEndTurn">;
  getPresentation?: () => Pick<BattlePresentationPort, "openingDrawPending" | "setOpeningDrawPending">;
}

export async function playBattleOpeningDraw(
  ctx: BattleOpeningDrawContext,
  transferDeps: Pick<ReturnType<typeof createBattleTransferDeps>, "getDrawSequenceDeps">,
): Promise<boolean> {
  const current = readBattle();
  const presentation = ctx.getPresentation?.() ?? useBattlePresentationStore.getState();
  if (!presentation.openingDrawPending) return false;
  presentation.setOpeningDrawPending(false);
  const sessionNum = ctx.playback.id;

  const completed = await runBattleDraw({
    oldHand: [],
    newState: current.battleState,
    onReveal: () => {},
    session: sessionNum,
    deps: transferDeps.getDrawSequenceDeps(),
    errorContext: "draw opening hand",
  });
  if (sessionNum === ctx.playback.id) {
    ctx.playback.completeAction(sessionNum);
    ctx.playback.scheduleAutoEndTurn(readBattle().battleState);
  }
  return completed;
}

/** Waits for mounted playback refs; opening-hand gameplay is already committed. */
export function useBattleOpeningDraw({
  ctx,
  transferDeps,
  hasActiveBattle,
  screen,
  playbackBound,
}: {
  ctx: BattleControllerContext;
  transferDeps: ReturnType<typeof createBattleTransferDeps>;
  hasActiveBattle: boolean;
  screen: Screen;
  playbackBound: boolean;
}) {
  const openingDrawPending = useBattlePresentationStore((state) => state.openingDrawPending);
  const playOpeningDrawWhenReady = useCallback(() => {
    if (!ctx.getPresentation().openingDrawPending || !ctx.battleSceneRef.current || !ctx.drawPileRef.current) {
      return undefined;
    }
    void playBattleOpeningDraw(ctx, transferDeps).catch((error: unknown) => {
      if (import.meta.env.DEV) console.warn("[openingDraw] best-effort presentation failed", error);
    });
  }, [transferDeps, ctx]);

  useEffect(() => {
    if (!playbackBound || !hasActiveBattle || screen !== "battle" || !openingDrawPending) return;
    playOpeningDrawWhenReady();
  }, [hasActiveBattle, openingDrawPending, playbackBound, playOpeningDrawWhenReady, screen]);
}
