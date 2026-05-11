// Destination availability and sampling helpers for run navigation.
// Depends on route filtering config, run progression constants, and alchemy destination types.
import { DESTINATION_CHOICES, DESTINATIONS_PER_ACT } from "@/lib/game-constants";

import { getAvailableDestinations as getFilteredDestinations } from "../config";
import type { Destination } from "../types";
import { sampleItems } from "../utils";

type DestinationAvailabilityInput = {
  destinationIndexInAct: number;
  currentHp: number;
  currentGold: number;
  maxHp: number;
};

// Boss routing is injected by act progress; normal filtering stays in config so HP/gold
// gates can be reused without knowing run progression.
export function getRunAvailableDestinations({ destinationIndexInAct, currentHp, currentGold, maxHp }: DestinationAvailabilityInput): Destination[] {
  if (destinationIndexInAct >= DESTINATIONS_PER_ACT - 1) {
    return ["Boss Combat"];
  }
  return getFilteredDestinations(currentHp, currentGold, maxHp);
}

// Creates the visible destination choices with the shared route count constant.
export function sampleDestinationChoices(destinations: Destination[]): Destination[] {
  return sampleItems(destinations, DESTINATION_CHOICES);
}
