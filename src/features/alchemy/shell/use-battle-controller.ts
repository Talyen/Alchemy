import { useEffect, useMemo, useLayoutEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getPlayableHandCardKeysExcludingHidden,
  useBattleAutoEndTurn,
  createBattleSession,
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
  createBattleEndTurnUi,
  createTurnOrchestrationDeps,
  createBattleTransferDeps,
  createBattleInit,
  createBattleCardPlay,
  createBattleDevOutcomes,
  isVictoryGraceActive,
  useBattleControllerContext,
} from "@/features/alchemy/run-loop/battle";
import type { CardRect, Screen } from "@/features/alchemy/shared/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import { useDisplayOverrides } from "@/features/alchemy/shared/stores/run-session-facade";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-facade";
import type { BattleState } from "@/lib/battle";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";

interface UseBattleControllerProps {
  run: RunStateController;
  talents: TalentStateController;
  autoEndTurn: boolean;
  homesteadEffects: HomesteadEffectManifest;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
  rng: () => number;
  measureElementRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
}

export function useBattleController({
  run,
  talents,
  autoEndTurn,
  homesteadEffects,
  screen,
  setHoveredCardId,
  onBattleVictory,
  onBattleDefeat,
  rng,
  measureElementRect = defaultMeasureElementRect,
  measureVisualCardRect = defaultMeasureVisualCardRect,
}: UseBattleControllerProps) {
  const {
    battle: { battleState, hasActiveBattle },
    activeLabyrinthModifiers,
  } = useRunSessionBattleContext(screen);
  const displayOverrides = useDisplayOverrides();
  const battlePresentation = useBattlePresentationStore(
    useShallow((s) => ({
      revealedCardKeys: s.revealedCardKeys,
      cardGhosts: s.cardGhosts,
      floatingCombatTexts: s.floatingCombatTexts,
      enemyShaking: s.enemyShaking,
      playerShaking: s.playerShaking,
      companionShaking: s.companionShaking,
      playerHurtFlashToken: s.playerHurtFlashToken,
      enemyHurtFlashToken: s.enemyHurtFlashToken,
    })),
  );
  const { hoveredCardId, shimmerState, maybeTriggerShimmer } = useUiStore(
    useShallow((s) => ({
      hoveredCardId: s.hoveredCardId,
      shimmerState: s.shimmerState,
      maybeTriggerShimmer: s.maybeTriggerShimmer,
    })),
  );
  const removeCardGhost = useBattlePresentationStore((s) => s.removeCardGhost);
  const clearFloatingCombatTexts = useBattlePresentationStore((s) => s.clearFloatingCombatTexts);

  const battleScreenData: BattleScreenData = useMemo(
    () => ({
      battleState,
      displayOverrides,
      ...battlePresentation,
      hoveredCardId,
      shimmerState,
      maybeTriggerShimmer,
      activeLabyrinthModifiers,
    }),
    [
      battleState,
      displayOverrides,
      battlePresentation,
      hoveredCardId,
      shimmerState,
      maybeTriggerShimmer,
      activeLabyrinthModifiers,
    ],
  );

  const scheduleAutoEndTurnRef = useRef<((state: BattleState) => void) | null>(null);
  const clearAutoEndTurnRef = useRef<(() => void) | null>(null);

  // Initialize/Update the unified context
  const ctx = useBattleControllerContext({
    run,
    talents,
    autoEndTurn,
    homesteadEffects,
    screen,
    setHoveredCardId,
    onBattleVictory,
    onBattleDefeat,
    measureElementRect,
    measureVisualCardRect,
    scheduleAutoEndTurnRef,
    clearAutoEndTurnRef,
  });

  // Instantiate action handlers exactly once on mount
  const actions = useMemo(() => {
    const session = createBattleSession(ctx);
    const transferDeps = createBattleTransferDeps(ctx, session.isCurrentBattleSession);
    const orchestrationDeps = createTurnOrchestrationDeps(ctx, session, transferDeps);
    const endTurnUi = createBattleEndTurnUi(ctx, session, transferDeps, orchestrationDeps);
    const cardPlay = createBattleCardPlay(ctx, session, transferDeps);
    const init = createBattleInit(ctx, session, rng);
    const devOutcomes = createBattleDevOutcomes(ctx, session);

    return {
      session,
      endTurnUi,
      cardPlay,
      init,
      devOutcomes,
    };
  }, [ctx, rng]);

  const hiddenHandCardKeys = useBattlePresentationStore((s) => s.hiddenHandCardKeys);
  const cardTransfers = useBattlePresentationStore((s) => s.cardTransfers);
  const cardTransferInProgress = useBattlePresentationStore((s) => s.cardTransferInProgress);

  // Auto end turn hook
  const { scheduleAutoEndTurn, clearAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn,
    screen,
    battleState,
    hasActiveBattle,
    cardTransferInProgress,
    hiddenHandCardKeys,
    onEndTurn: actions.endTurnUi.handleEndTurn,
  });

  // Wire schedule/clear auto-end back into context for card play and end-turn
  useLayoutEffect(() => {
    scheduleAutoEndTurnRef.current = scheduleAutoEndTurn;
    clearAutoEndTurnRef.current = clearAutoEndTurn;
  }, [scheduleAutoEndTurn, clearAutoEndTurn]);

  // Playable hand card keys
  const playableHandCardKeys = useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, hiddenHandCardKeys),
    [battleState, hiddenHandCardKeys],
  );

  const resetHandTransferUi = useBattlePresentationStore((s) => s.resetHandTransferUi);

  useEffect(() => {
    if (hasActiveBattle) return;
    if (isVictoryGraceActive(screen, battleState.enemyHealth, ctx.victoryDefeatHandledRef.current)) return;
    actions.session.resetBattleSession();
    queueMicrotask(() => {
      useBattlePresentationStore.getState().resetCardTransfers();
      resetHandTransferUi();
    });
  }, [hasActiveBattle, screen, battleState.enemyHealth, actions.session, resetHandTransferUi, ctx]);

  useEffect(() => {
    if (screen !== "battle") {
      clearFloatingCombatTexts();
    }
  }, [screen, clearFloatingCombatTexts]);

  return {
    battleState,
    battleScreenData,
    hasActiveBattle,
    handCardRefs: ctx.handCardRefs,
    drawPileRef: ctx.drawPileRef,
    discardPileRef: ctx.discardPileRef,
    battleSceneRef: ctx.battleSceneRef,
    playerPanelRef: ctx.playerPanelRef,
    enemyPanelRef: ctx.enemyPanelRef,
    cardTransfers,
    hiddenHandCardKeys,
    cardTransferInProgress,
    startBattle: actions.init.startBattle,
    startBossBattle: actions.init.startBossBattle,
    startBossById: actions.init.startBossById,
    handleCardClick: actions.cardPlay.handleCardClick,
    handleWishChoice: actions.cardPlay.handleWishChoice,
    handleEndTurn: actions.endTurnUi.handleEndTurn,
    handleEndRun: actions.devOutcomes.handleEndRun,
    skipCombatDevMode: actions.devOutcomes.skipCombatDevMode,
    removeCardGhost,
    playableHandCardKeys,
  };
}
