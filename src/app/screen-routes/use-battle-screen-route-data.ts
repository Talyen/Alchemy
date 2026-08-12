// Route-local battle display reads — keeps presentation/display out of routeCommands.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useActiveRunScreenValue, useDisplayOverrides } from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-model";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
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
      hiddenHandCardKeys: s.hiddenHandCardKeys,
      cardTransfers: s.cardTransfers,
      cardTransferInProgress: s.cardTransferInProgress,
    })),
  );
  const battleScreenData: BattleScreenData = useMemo(
    () => ({
      battleState,
      displayOverrides,
      revealedCardKeys: battlePresentation.revealedCardKeys,
      cardGhosts: battlePresentation.cardGhosts,
      activeLabyrinthModifiers,
    }),
    [
      battleState,
      displayOverrides,
      battlePresentation.revealedCardKeys,
      battlePresentation.cardGhosts,
      activeLabyrinthModifiers,
    ],
  );

  const playableHandCardKeys = useMemo(
    () =>
      getPlayableHandCardKeysExcludingHidden(
        {
          hand: battleState.hand,
          turnPhase: battleState.turnPhase,
          mana: battleState.mana,
          wishOptions: battleState.wishOptions,
          flags: battleState.flags,
          talentEffects: battleState.talentEffects,
          trinketEffects: battleState.trinketEffects,
        },
        battlePresentation.hiddenHandCardKeys,
      ),
    [
      battleState.hand,
      battleState.turnPhase,
      battleState.mana,
      battleState.wishOptions,
      battleState.flags,
      battleState.talentEffects,
      battleState.trinketEffects,
      battlePresentation.hiddenHandCardKeys,
    ],
  );

  return {
    battleScreenData,
    cardTransfers: battlePresentation.cardTransfers,
    hiddenHandCardKeys: battlePresentation.hiddenHandCardKeys,
    cardTransferInProgress: battlePresentation.cardTransferInProgress,
    playableHandCardKeys,
  };
}
