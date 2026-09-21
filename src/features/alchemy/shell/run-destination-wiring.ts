import { resolveAvailableDestinations, type DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import { readHasAnyOwnedGear, readHasUnownedTrinkets } from "@/features/alchemy/shared/stores/gear-store";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

/** Shared hover-clear used by every shell navigation path. */
export function clearRunCardHover(): void {
  useUiStore.getState().clearCardHover();
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
