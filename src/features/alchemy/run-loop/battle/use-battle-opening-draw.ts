import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect } from "react";
import type { BattleControllerContext } from "./battle-context";
import { playBattleOpeningDraw } from "./battle-init";
import { useBattlePresentationStore } from "./battle-presentation-store";
import type { createBattleTransferDeps } from "./battle-transfer-deps";

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
      !useBattlePresentationStore.getState().openingDrawPending ||
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
