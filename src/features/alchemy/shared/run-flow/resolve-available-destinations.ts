// Pure destination availability for shell wiring — run-setup / run-loop stay phase-isolated.
import type { Destination } from "@/lib/routing";
import { getPreviousDestination } from "./campaign-start";
import { getRunAvailableDestinations, type DestinationOptionsInput } from "./destination-flow";

export interface ResolveAvailableDestinationsInput {
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runPlayerHealth: number;
  runGold: number;
  runMaxHealth: number;
  hasAnyOwnedGear: boolean;
  hasUnownedTrinkets?: boolean;
  options?: DestinationOptionsInput;
}

/** Resolve the next-room destination pool from run progress + optional overrides. */
export function resolveAvailableDestinations(input: ResolveAvailableDestinationsInput): Destination[] {
  const options = input.options ?? {};
  const destinationIndexInAct = options.destinationIndexInAct ?? input.destinationIndexInAct;
  const previousDestination = getPreviousDestination(destinationIndexInAct, input.completedDestinations);
  return getRunAvailableDestinations({
    destinationIndexInAct,
    currentHealth: options.currentHealth ?? input.runPlayerHealth,
    currentGold: options.currentGold ?? input.runGold,
    maxHealth: options.maxHealth ?? input.runMaxHealth,
    previousDestination,
    hasAnyOwnedGear: options.hasAnyOwnedGear ?? input.hasAnyOwnedGear,
    hasUnownedTrinkets: options.hasUnownedTrinkets ?? input.hasUnownedTrinkets ?? true,
  });
}
