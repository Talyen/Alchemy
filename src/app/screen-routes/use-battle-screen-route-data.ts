// Route-local battle display reads — keeps presentation/display out of routeCommands.
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  useActiveRunScreenValue,
  useActiveRunTrinkets,
  useDisplayOverrides,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
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
  const runTrinkets = useActiveRunTrinkets();
  const battlePresentation = useBattlePresentationStore(
    useShallow((s) => ({
      revealedCardKeys: s.revealedCardKeys,
      hiddenHandCardKeys: s.hiddenHandCardKeys,
      cardTransferInProgress: s.cardTransferInProgress,
    })),
  );
  const battleScreenData: BattleScreenData = useMemo(
    () => ({
      battleState,
      displayOverrides,
      revealedCardKeys: battlePresentation.revealedCardKeys,
      activeLabyrinthModifiers,
      runTrinkets,
    }),
    [battleState, displayOverrides, battlePresentation.revealedCardKeys, activeLabyrinthModifiers, runTrinkets],
  );

  const playableHandCardKeys = useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, battlePresentation.hiddenHandCardKeys),
    [battleState, battlePresentation.hiddenHandCardKeys],
  );

  return {
    battleScreenData,
    hiddenHandCardKeys: battlePresentation.hiddenHandCardKeys,
    cardTransferInProgress: battlePresentation.cardTransferInProgress,
    playableHandCardKeys,
  };
}
