import { campaignLootDepth, isLootEligible } from "@/lib/loot";
import type { Destination } from "@/lib/routing";
import { getRunAvailableDestinations } from "./destination-flow";

function getPreviousDestination(
  destinationIndexInAct: number,
  completedDestinations: readonly Destination[],
): Destination | undefined {
  return destinationIndexInAct === 0 ? undefined : completedDestinations[completedDestinations.length - 1];
}

/** Progress and collection eligibility from the same transaction as the offer. */
export interface DestinationEligibilityContext {
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: readonly Destination[];
  hasAnyOwnedGear: boolean;
  hasUnownedTrinkets: boolean;
}

export interface ResolveAvailableDestinationsInput extends DestinationEligibilityContext {
  runPlayerHealth: number;
  gold: number;
  runMaxHealth: number;
}

export function resolveAvailableDestinations(input: ResolveAvailableDestinationsInput): Destination[] {
  return getRunAvailableDestinations({
    destinationIndexInAct: input.destinationIndexInAct,
    currentHealth: input.runPlayerHealth,
    currentGold: input.gold,
    maxHealth: input.runMaxHealth,
    previousDestination: getPreviousDestination(input.destinationIndexInAct, input.completedDestinations),
    hasAnyOwnedGear: input.hasAnyOwnedGear,
    hasUnownedTrinkets:
      input.hasUnownedTrinkets &&
      isLootEligible("trinket", campaignLootDepth(input.currentAct, input.destinationIndexInAct + 1)),
  });
}
