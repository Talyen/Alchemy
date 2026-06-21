/* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization -- factories receive ref objects for async handlers; ref.current assignments are deliberate */
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { getPlayableHandCardKeysExcludingHidden } from "@/features/alchemy/run-loop/battle/playable-hand";
import type { CardRect, Screen } from "@/features/alchemy/shared/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import { useBattleAutoEndTurn } from "@/features/alchemy/run-loop/battle/use-battle-auto-end-turn";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import { useBattlePresentationStore } from "@/features/alchemy/shared/stores/battle-presentation-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-facade";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import {
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import {
  createBattleEndTurnUi,
  createTurnOrchestrationDeps,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import { createBattleDevOutcomes } from "@/features/alchemy/run-loop/battle/battle-dev-outcomes";
import { isVictoryGraceActive } from "@/features/alchemy/run-loop/battle/battle-victory-grace";
import { useBattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";

type UseBattleControllerProps = {
  run: RunStateController;
  talents: TalentStateController;
  autoEndTurn: boolean;
  homesteadEffectsRef: React.RefObject<HomesteadEffectManifest>;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
  measureElementRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
};

export function useBattleController({
  run,
  talents,
  autoEndTurn,
  homesteadEffectsRef,
  screen,
  setHoveredCardId,
  onBattleVictory,
  onBattleDefeat,
  measureElementRect = defaultMeasureElementRect,
  measureVisualCardRect = defaultMeasureVisualCardRect,
}: UseBattleControllerProps) {
  const {
    battle: { battleState, hasActiveBattle },
    activeLabyrinthModifiers,
  } = useRunSessionBattleContext(screen);
  const displayOverrides = useRunDomainStore((s) => s.battle.displayOverrides);
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

  // Initialize/Update the unified context
  const ctx = useBattleControllerContext({
    run,
    talents,
    autoEndTurn,
    homesteadEffectsRef,
    screen,
    setHoveredCardId,
    onBattleVictory,
    onBattleDefeat,
    measureElementRect,
    measureVisualCardRect,
  });

  // Instantiate action handlers exactly once on mount
  const actions = useMemo(() => {
    const session = createBattleSession(ctx);
    const transferDeps = createBattleTransferDeps(ctx, session.isCurrentBattleSession);
    const orchestrationDeps = createTurnOrchestrationDeps(ctx, session, transferDeps);
    const endTurnUi = createBattleEndTurnUi(ctx, session, transferDeps, orchestrationDeps);
    const cardPlay = createBattleCardPlay(ctx, session, transferDeps);
    const init = createBattleInit(ctx, session);
    const devOutcomes = createBattleDevOutcomes(ctx, session);

    return {
      session,
      endTurnUi,
      cardPlay,
      init,
      devOutcomes,
    };
  }, [ctx]);

  // Auto end turn hook
  const { scheduleAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn,
    screen,
    battleState,
    onEndTurn: actions.endTurnUi.handleEndTurn,
  });

  // Wire scheduleAutoEndTurn back into context so card play can call it
  ctx.scheduleAutoEndTurn = scheduleAutoEndTurn;

  // Playable hand card keys
  const hiddenHandCardKeys = useBattlePresentationStore((s) => s.hiddenHandCardKeys);
  const playableHandCardKeys = useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, hiddenHandCardKeys),
    [battleState, hiddenHandCardKeys],
  );

  const cardTransfers = useBattlePresentationStore((s) => s.cardTransfers);
  const cardTransferInProgress = useBattlePresentationStore((s) => s.cardTransferInProgress);

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
