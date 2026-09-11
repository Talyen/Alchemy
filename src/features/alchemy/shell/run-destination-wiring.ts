import { resolveAvailableDestinations, type DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import { readHasAnyOwnedGear, readHasUnownedTrinkets } from "@/features/alchemy/shared/stores/gear-store";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import type { Screen } from "@/lib/routing";
export function createRunDestinationWiring({
  navigateTo,
  clearCardHover,
}: {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  clearCardHover: () => void;
}) {
  const goToScreen = (nextScreen: Screen) => {
    clearCardHover();
    navigateTo(nextScreen);
  };
  return { getAvailableDestinations: getRunAvailableDestinations, goToScreen };
}

export function getRunAvailableDestinations(options: DestinationOptionsInput = {}) {
  const active = readActiveRun();
  return resolveAvailableDestinations({
    currentAct: active.currentAct,
    destinationIndexInAct: active.destinationIndexInAct,
    completedDestinations: active.completedDestinations,
    runPlayerHealth: active.runPlayerHealth,
    gold: readRunProfile().gold,
    runMaxHealth: active.runMaxHealth,
    hasAnyOwnedGear: readHasAnyOwnedGear(),
    hasUnownedTrinkets: readHasUnownedTrinkets(),
    options,
  });
}
