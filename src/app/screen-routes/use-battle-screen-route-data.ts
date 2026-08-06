// Route-local battle display reads — keeps presentation/display out of routeCommands.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useActiveRunScreenValue, useDisplayOverrides } from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-model";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { getPlayableHandCardKeysExcludingHidden } from "@/features/alchemy/run-loop/battle/playable-hand";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";

export function useBattleScreenRouteData() {
  const screen = useActiveRunScreenValue();
  const {
    battle: { battleState },
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
      hiddenHandCardKeys: s.hiddenHandCardKeys,
      cardTransfers: s.cardTransfers,
      cardTransferInProgress: s.cardTransferInProgress,
    })),
  );
  const { hoveredCardId, shimmerState, maybeTriggerShimmer } = useUiStore(
    useShallow((s) => ({
      hoveredCardId: s.hoveredCardId,
      shimmerState: s.shimmerState,
      maybeTriggerShimmer: s.maybeTriggerShimmer,
    })),
  );

  const battleScreenData: BattleScreenData = useMemo(
    () => ({
      battleState,
      displayOverrides,
      revealedCardKeys: battlePresentation.revealedCardKeys,
      cardGhosts: battlePresentation.cardGhosts,
      floatingCombatTexts: battlePresentation.floatingCombatTexts,
      enemyShaking: battlePresentation.enemyShaking,
      playerShaking: battlePresentation.playerShaking,
      companionShaking: battlePresentation.companionShaking,
      playerHurtFlashToken: battlePresentation.playerHurtFlashToken,
      enemyHurtFlashToken: battlePresentation.enemyHurtFlashToken,
      hoveredCardId,
      shimmerState,
      maybeTriggerShimmer,
      activeLabyrinthModifiers,
    }),
    [
      battleState,
      displayOverrides,
      battlePresentation.revealedCardKeys,
      battlePresentation.cardGhosts,
      battlePresentation.floatingCombatTexts,
      battlePresentation.enemyShaking,
      battlePresentation.playerShaking,
      battlePresentation.companionShaking,
      battlePresentation.playerHurtFlashToken,
      battlePresentation.enemyHurtFlashToken,
      hoveredCardId,
      shimmerState,
      maybeTriggerShimmer,
      activeLabyrinthModifiers,
    ],
  );

  const playableHandCardKeys = useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, battlePresentation.hiddenHandCardKeys),
    [battleState, battlePresentation.hiddenHandCardKeys],
  );

  return {
    battleScreenData,
    cardTransfers: battlePresentation.cardTransfers,
    hiddenHandCardKeys: battlePresentation.hiddenHandCardKeys,
    cardTransferInProgress: battlePresentation.cardTransferInProgress,
    playableHandCardKeys,
  };
}
