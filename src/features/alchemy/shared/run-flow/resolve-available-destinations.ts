import type { Destination } from "@/lib/routing";
import { getRunAvailableDestinations, type DestinationOptionsInput } from "./destination-flow";

export function getPreviousDestination(
  destinationIndexInAct: number,
  completedDestinations: Destination[],
): Destination | undefined {
  return destinationIndexInAct === 0 ? undefined : completedDestinations[completedDestinations.length - 1];
}

export interface ResolveAvailableDestinationsInput {
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runPlayerHealth: number;
  gold: number;
  runMaxHealth: number;
  hasAnyOwnedGear: boolean;
  hasUnownedTrinkets?: boolean;
  options?: DestinationOptionsInput;
}

export function resolveAvailableDestinations(input: ResolveAvailableDestinationsInput): Destination[] {
  const options = input.options ?? {};
  const destinationIndexInAct = options.destinationIndexInAct ?? input.destinationIndexInAct;
  const previousDestination = getPreviousDestination(destinationIndexInAct, input.completedDestinations);
  return getRunAvailableDestinations({
    destinationIndexInAct,
    currentHealth: options.currentHealth ?? input.runPlayerHealth,
    currentGold: options.currentGold ?? input.gold,
    maxHealth: options.maxHealth ?? input.runMaxHealth,
    previousDestination,
    hasAnyOwnedGear: options.hasAnyOwnedGear ?? input.hasAnyOwnedGear,
    hasUnownedTrinkets: options.hasUnownedTrinkets ?? input.hasUnownedTrinkets ?? true,
  });
}
