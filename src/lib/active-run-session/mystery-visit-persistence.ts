import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import type { PersistedMysteryVisit } from "./types";

export interface HydratedMysteryVisit {
  mysteryEvent: MysteryEvent | null;
  mysteryChosenChoice: MysteryChoice | null;
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryGrantedGearInstances: GearInstance[];
  mysteryChosenCardId: string | null;
}

export function emptyHydratedMysteryVisit(): HydratedMysteryVisit {
  return {
    mysteryEvent: null,
    mysteryChosenChoice: null,
    mysteryCardChoices: null,
    mysteryGrantedTrinketIds: [],
    mysteryGrantedGearInstances: [],
    mysteryChosenCardId: null,
  };
}

export function serializeMysteryVisit(visit: HydratedMysteryVisit): PersistedMysteryVisit | null {
  const event = visit.mysteryEvent;
  if (!event) return null;
  return {
    event,
    chosenChoice: visit.mysteryChosenChoice,
    cardChoices: visit.mysteryCardChoices,
    grantedTrinketIds: visit.mysteryGrantedTrinketIds,
    grantedGear: visit.mysteryGrantedGearInstances,
    chosenCardId: visit.mysteryChosenCardId,
  };
}

export function hydrateMysteryVisit(data: PersistedMysteryVisit | null): HydratedMysteryVisit {
  if (!data) return emptyHydratedMysteryVisit();
  return {
    mysteryEvent: data.event,
    mysteryChosenChoice: data.chosenChoice,
    mysteryCardChoices: data.cardChoices,
    mysteryGrantedTrinketIds: data.grantedTrinketIds,
    mysteryGrantedGearInstances: data.grantedGear ?? [],
    mysteryChosenCardId: data.chosenCardId,
  };
}
