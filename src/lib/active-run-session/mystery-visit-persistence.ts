// Persist / hydrate mystery visit state for active-run snapshots.
import { findMysteryEvent, type MysteryChoice, type MysteryEffect, type MysteryEvent } from "@/lib/mystery";
import type { BattleCard } from "@/lib/game-data";
import type { PersistedMysteryVisit } from "./types";

export interface HydratedMysteryVisit {
  mysteryEvent: MysteryEvent | null;
  mysteryChosenChoice: MysteryChoice | null;
  mysteryPendingRemoval: boolean;
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryChosenCardId: string | null;
}

export function emptyHydratedMysteryVisit(): HydratedMysteryVisit {
  return {
    mysteryEvent: null,
    mysteryChosenChoice: null,
    mysteryPendingRemoval: false,
    mysteryCardChoices: null,
    mysteryGrantedTrinketIds: [],
    mysteryChosenCardId: null,
  };
}

export function serializeMysteryVisit(visit: {
  mysteryEvent: MysteryEvent | null;
  mysteryChosenChoice: MysteryChoice | null;
  mysteryPendingRemoval: boolean;
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryChosenCardId: string | null;
}): PersistedMysteryVisit | null {
  const event = visit.mysteryEvent;
  if (!event) return null;
  return {
    eventId: event.id,
    chosenChoice: visit.mysteryChosenChoice,
    pendingRemoval: visit.mysteryPendingRemoval,
    cardChoices: visit.mysteryCardChoices,
    grantedTrinketIds: visit.mysteryGrantedTrinketIds,
    chosenCardId: visit.mysteryChosenCardId,
  };
}

export function hydrateMysteryVisit(data: PersistedMysteryVisit | null): HydratedMysteryVisit {
  if (!data) return emptyHydratedMysteryVisit();
  const mysteryEvent = findMysteryEvent(data.eventId);
  if (!mysteryEvent) return emptyHydratedMysteryVisit();
  return {
    mysteryEvent,
    mysteryChosenChoice: hydratePersistedMysteryChoice(data.chosenChoice),
    mysteryPendingRemoval: data.pendingRemoval,
    mysteryCardChoices: data.cardChoices,
    mysteryGrantedTrinketIds: data.grantedTrinketIds,
    mysteryChosenCardId: data.chosenCardId,
  };
}

export function hydratePersistedMysteryChoice(
  choice: { label: string; effects: readonly MysteryEffect[] } | null,
): MysteryChoice | null {
  if (!choice) return null;
  return {
    label: choice.label,
    effects: choice.effects.map((effect): MysteryEffect => {
      if (effect.kind !== "chooseCard") return effect;
      return "tag" in effect && effect.tag ? { kind: "chooseCard", tag: effect.tag } : { kind: "chooseCard" };
    }),
  };
}
