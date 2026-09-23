import type { MysteryChoice, MysteryEffect, MysteryEvent } from "@/lib/mystery";
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { PersistedMysteryVisit } from "./types";

export interface HydratedMysteryVisit {
  mysteryEvent: MysteryEvent | null;
  mysteryChosenChoice: MysteryChoice | null;
  // Legacy: no live flow sets player-choice removal anymore (removeCard resolves
  // immediately). Kept so old saves and stale visits still parse and clear.
  mysteryPendingRemoval: boolean;
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryGrantedGearInstances: GearInstance[];
  mysteryChosenCardId: string | null;
}

export function emptyHydratedMysteryVisit(): HydratedMysteryVisit {
  return {
    mysteryEvent: null,
    mysteryChosenChoice: null,
    mysteryPendingRemoval: false,
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
    ...(visit.mysteryPendingRemoval ? { pendingRemoval: true } : {}),
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
    mysteryChosenChoice: hydratePersistedMysteryChoice(data.chosenChoice),
    mysteryPendingRemoval: data.pendingRemoval === true,
    mysteryCardChoices: data.cardChoices,
    mysteryGrantedTrinketIds: data.grantedTrinketIds,
    mysteryGrantedGearInstances: data.grantedGear ?? [],
    mysteryChosenCardId: data.chosenCardId,
  };
}

export interface PersistedMysteryChoiceInput {
  label: string;
  effects: ReadonlyArray<MysteryEffect | { kind: string; [key: string]: unknown }>;
}

export function hydratePersistedMysteryChoice(choice: PersistedMysteryChoiceInput | null): MysteryChoice | null {
  if (!choice) return null;
  return {
    label: choice.label,
    effects: choice.effects.map((effect): MysteryEffect => {
      if (effect.kind !== "chooseCard") return effect as MysteryEffect;
      return "tag" in effect && typeof effect.tag === "string" && effect.tag
        ? { kind: "chooseCard", tag: effect.tag as import("@/lib/game-data").KeywordId }
        : { kind: "chooseCard" };
    }),
  };
}
