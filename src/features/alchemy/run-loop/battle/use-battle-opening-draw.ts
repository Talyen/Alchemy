import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect } from "react";
import type { BattleControllerContext } from "./battle-context";
import { useBattlePresentationStore, type BattlePresentationPort } from "./battle-presentation-store";
import { runBattleDraw, type createBattleTransferDeps } from "./draw-sequence";

export interface BattleOpeningDrawContext {
  battleSessionRef: BattleControllerContext["battleSessionRef"];
  scheduleAutoEndTurnRef: BattleControllerContext["scheduleAutoEndTurnRef"];
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
  const sessionNum = ctx.battleSessionRef.current;

  const completed = await runBattleDraw({
    oldHand: [],
    newState: current.battleState,
    onReveal: () => {},
    session: sessionNum,
    deps: transferDeps.getDrawSequenceDeps(),
    errorContext: "draw opening hand",
  });
  if (sessionNum === ctx.battleSessionRef.current) {
    ctx.scheduleAutoEndTurnRef.current?.(readBattle().battleState);
  }
  return completed;
}

/** Waits for mounted playback refs; opening-hand gameplay is already committed. */
export function useBattleOpeningDraw({
  ctx,
  transferDeps,
  hasActiveBattle,
  screen,
  pendingTransitionResumeRequired,
  playbackBindVersion,
}: {
  ctx: BattleControllerContext;
  transferDeps: ReturnType<typeof createBattleTransferDeps>;
  hasActiveBattle: boolean;
  screen: Screen;
  pendingTransitionResumeRequired: boolean;
  playbackBindVersion: number;
}) {
  const openingDrawPending = useBattlePresentationStore((state) => state.openingDrawPending);
  const playOpeningDrawWhenReady = useCallback(() => {
    let battle: ReturnType<typeof readBattle>;
    try {
      battle = readBattle();
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[battle] unable to read opening-draw state", error);
      return undefined;
    }
    if (
      battle.pendingTransitionResumeRequired ||
      !ctx.getPresentation().openingDrawPending ||
      !ctx.battleSceneRef.current ||
      !ctx.drawPileRef.current
    ) {
      return undefined;
    }
    void playBattleOpeningDraw(ctx, transferDeps).catch((error: unknown) => {
      if (import.meta.env.DEV) console.warn("[openingDraw] best-effort presentation failed", error);
    });
  }, [transferDeps, ctx]);

  useEffect(() => {
    if (!hasActiveBattle || screen !== "battle" || pendingTransitionResumeRequired || !openingDrawPending) {
      return;
    }
    playOpeningDrawWhenReady();
  }, [
    hasActiveBattle,
    openingDrawPending,
    pendingTransitionResumeRequired,
    playbackBindVersion,
    playOpeningDrawWhenReady,
    screen,
  ]);
}
