import { useCallback, useMemo } from "react";
import { readHasAnyOwnedGear, readHasUnownedTrinkets } from "@/features/alchemy/shared/stores/gear-store";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { resolveAvailableDestinations, type DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import type { Screen } from "@/lib/routing";

export function useRunDestinationWiring({
  navigateTo,
  clearCardHover,
}: {
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  clearCardHover: () => void;
}) {
  const getAvailableDestinations = useCallback((options: DestinationOptionsInput = {}) => {
    const active = readActiveRun();
    return resolveAvailableDestinations({
      destinationIndexInAct: active.destinationIndexInAct,
      completedDestinations: active.completedDestinations,
      runPlayerHealth: active.runPlayerHealth,
      gold: readRunProfile().gold,
      runMaxHealth: active.runMaxHealth,
      hasAnyOwnedGear: readHasAnyOwnedGear(),
      hasUnownedTrinkets: readHasUnownedTrinkets(),
      options,
    });
  }, []);

  const goToScreen = useCallback(
    (nextScreen: Screen) => {
      clearCardHover();
      navigateTo(nextScreen);
    },
    [clearCardHover, navigateTo],
  );

  return useMemo(() => ({ getAvailableDestinations, goToScreen }), [getAvailableDestinations, goToScreen]);
}
