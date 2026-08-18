// Destination / screen navigation helpers for run-flow shell wiring.
import { useCallback, useMemo } from "react";
import type { DestinationRunPort } from "@/features/alchemy/shared/stores/run-port-types";
import { readHasAnyOwnedGear } from "@/features/alchemy/shared/stores/gear-store";
import { resolveAvailableDestinations, type DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";

export function useRunDestinationWiring({
  run,
  hasActiveBattle,
  navigateTo,
  clearCardHover,
}: {
  run: DestinationRunPort;
  hasActiveBattle: boolean;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  clearCardHover: () => void;
}) {
  const getAvailableDestinations = useMemo(
    () =>
      (options: DestinationOptionsInput = {}) =>
        resolveAvailableDestinations({
          destinationIndexInAct: run.destinationIndexInAct,
          completedDestinations: run.completedDestinations,
          runPlayerHealth: run.runPlayerHealth,
          runGold: run.runGold,
          runMaxHealth: run.runMaxHealth,
          hasAnyOwnedGear: readHasAnyOwnedGear(),
          options,
        }),
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

  return useMemo(
    () => ({ getAvailableDestinations, returnToBattle, goToScreen }),
    [getAvailableDestinations, returnToBattle, goToScreen],
  );
}
