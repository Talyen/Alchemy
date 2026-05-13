// Destination availability and sampling helpers for run navigation.
// Depends on route filtering config, run progression constants, and alchemy destination types.
import { CORRUPTION_DESTINATION_WEIGHT, DEFAULT_DESTINATION_WEIGHT, DESTINATION_CHOICES, DESTINATIONS_PER_ACT } from "@/lib/game-constants";

import { getAvailableDestinations as getFilteredDestinations } from "../config";
import { DESTINATIONS, type Destination } from "../types";

type DestinationAvailabilityInput = {
  destinationIndexInAct: number;
  currentHp: number;
  currentGold: number;
  maxHp: number;
  previousDestination?: Destination | undefined;
};

// Boss routing is injected by act progress; normal filtering stays in config so HP/gold
// gates can be reused without knowing run progression.
export function getRunAvailableDestinations({ destinationIndexInAct, currentHp, currentGold, maxHp, previousDestination }: DestinationAvailabilityInput): Destination[] {
  if (destinationIndexInAct >= DESTINATIONS_PER_ACT - 1) {
    return [DESTINATIONS.BOSS_COMBAT];
  }
  const destinations = getFilteredDestinations(currentHp, currentGold, maxHp);
  return previousDestination === DESTINATIONS.CORRUPTION
    ? destinations.filter((destination) => destination !== DESTINATIONS.CORRUPTION)
    : destinations;
}

// Creates the visible destination choices with the shared route count constant.
export function sampleDestinationChoices(destinations: Destination[]): Destination[] {
  const choices: Destination[] = [];
  const remaining = [...destinations];

  while (choices.length < DESTINATION_CHOICES && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, destination) => sum + getDestinationWeight(destination), 0);
    let roll = Math.random() * totalWeight;
    const selectedIndex = remaining.findIndex((destination) => {
      roll -= getDestinationWeight(destination);
      return roll < 0;
    });
    const [selected] = remaining.splice(selectedIndex >= 0 ? selectedIndex : remaining.length - 1, 1);
    choices.push(selected);
  }

  return choices;
}

// Rare route weighting lives with sampling so availability rules stay purely boolean.
export function getDestinationWeight(destination: Destination) {
  return destination === DESTINATIONS.CORRUPTION ? CORRUPTION_DESTINATION_WEIGHT : DEFAULT_DESTINATION_WEIGHT;
}
