// Destination / screen navigation helpers for run-flow shell wiring.
import { useCallback, useMemo } from "react";
import type { RunStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import { readHasAnyOwnedGear } from "@/features/alchemy/shared/stores/gear-read-port";
import { bindAvailableDestinationsResolver } from "@/features/alchemy/shared/run-flow";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";

export function useRunDestinationWiring({
  run,
  hasActiveBattle,
  navigateTo,
  clearCardHover,
}: {
  run: RunStateController;
  hasActiveBattle: boolean;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  clearCardHover: () => void;
}) {
  const getAvailableDestinations = useMemo(
    () =>
      bindAvailableDestinationsResolver(() => ({
        destinationIndexInAct: run.destinationIndexInAct,
        completedDestinations: run.completedDestinations,
        runPlayerHealth: run.runPlayerHealth,
        runGold: run.runGold,
        runMaxHealth: run.runMaxHealth,
        hasAnyOwnedGear: readHasAnyOwnedGear(),
      })),
    [run.destinationIndexInAct, run.completedDestinations, run.runPlayerHealth, run.runGold, run.runMaxHealth],
  );

  const returnToBattle = useCallback(() => {
    if (hasActiveBattle) navigateTo(CONSTANTS.SCREENS.BATTLE);
  }, [hasActiveBattle, navigateTo]);

  const goToScreen = useCallback(
    (nextScreen: Screen) => {
      clearCardHover();
      navigateTo(nextScreen);
    },
    [clearCardHover, navigateTo],
  );

  return { getAvailableDestinations, returnToBattle, goToScreen };
}
