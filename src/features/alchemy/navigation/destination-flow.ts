// Destination availability and sampling helpers for run navigation.
// Depends on: route filtering config, run progression constants, and alchemy types.
// Depended on by: useRunNavigation for sampling and getting available destinations.
import {
  CORRUPTION_DESTINATION_WEIGHT,
  DEFAULT_DESTINATION_WEIGHT,
  DESTINATION_CHOICES,
  DESTINATIONS_PER_ACT,
  PREVIOUS_DESTINATION_WEIGHT,
} from "@/lib/game-constants";

import { getAvailableDestinations as getFilteredDestinations } from "../config";
import { DESTINATIONS, type Destination } from "../types";

type DestinationAvailabilityInput = {
  destinationIndexInAct: number;
  currentHealth: number;
  currentGold: number;
  maxHealth: number;
  previousDestination?: Destination | undefined;
};

// Boss routing is injected by act progress; normal filtering stays in config so Health/gold
// gates can be reused without knowing run progression.
export function getRunAvailableDestinations({
  destinationIndexInAct,
  currentHealth,
  currentGold,
  maxHealth,
  previousDestination,
}: DestinationAvailabilityInput): Destination[] {
  if (destinationIndexInAct >= DESTINATIONS_PER_ACT - 1) {
    return [DESTINATIONS.BOSS_COMBAT];
  }
  const destinations = getFilteredDestinations(currentHealth, currentGold, maxHealth);
  return previousDestination === DESTINATIONS.CORRUPTION
    ? destinations.filter((destination) => destination !== DESTINATIONS.CORRUPTION)
    : destinations;
}

// Creates the visible destination choices with the shared route count constant.
// The previousDestination (room type just visited) gets a reduced weight.
export function sampleDestinationChoices(
  destinations: Destination[],
  previousDestination?: Destination,
): Destination[] {
  const choices: Destination[] = [];
  const remaining = [...destinations];

  while (choices.length < DESTINATION_CHOICES && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, dest) => sum + getDestinationWeight(dest, previousDestination), 0);
    let roll = Math.random() * totalWeight;
    const selectedIndex = remaining.findIndex((dest) => {
      roll -= getDestinationWeight(dest, previousDestination);
      return roll < 0;
    });
    const [selected] = remaining.splice(selectedIndex >= 0 ? selectedIndex : remaining.length - 1, 1);
    choices.push(selected);
  }

  return choices;
}

// Rare route weighting lives with sampling so availability rules stay purely boolean.
// The previous destination gets a reduced weight to de-prioritize it.
export function getDestinationWeight(destination: Destination, previousDestination?: Destination) {
  if (destination === previousDestination) return PREVIOUS_DESTINATION_WEIGHT;
  if (destination === DESTINATIONS.CORRUPTION) return CORRUPTION_DESTINATION_WEIGHT;
  return DEFAULT_DESTINATION_WEIGHT;
}
