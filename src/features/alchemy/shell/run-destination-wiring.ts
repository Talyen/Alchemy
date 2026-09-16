import { resolveAvailableDestinations, type DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import { readHasAnyOwnedGear, readHasUnownedTrinkets } from "@/features/alchemy/shared/stores/gear-store";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { Screen } from "@/lib/routing";

/** Shared hover-clear used by every shell navigation path. */
export function clearRunCardHover(): void {
  useUiStore.getState().clearCardHover();
}

export function createRunDestinationWiring({
  navigateTo,
  clearCardHover = clearRunCardHover,
}: {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  clearCardHover?: () => void;
}) {
  const goToScreen = (nextScreen: Screen) => {
    clearCardHover();
    navigateTo(nextScreen);
  };
  return { getAvailableDestinations: readRunAvailableDestinations, goToScreen };
}

/**
 * Store-backed destination reader for live runs.
 * The pure filtering helper lives in `shared/run-flow/destination-flow.ts`
 * (`getRunAvailableDestinations`); this wrapper only maps store reads to it.
 */
export function readRunAvailableDestinations(options: DestinationOptionsInput = {}) {
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
