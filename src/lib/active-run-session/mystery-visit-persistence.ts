import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice, MysteryEffect, MysteryEvent } from "@/lib/mystery";
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

interface PersistedMysteryEventInput {
  id: string;
  title: string;
  art: string;
  narrative: string;
  choices: readonly PersistedMysteryChoiceInput[];
}

function hydrateMysteryEvent(event: PersistedMysteryEventInput | MysteryEvent | null): MysteryEvent | null {
  if (!event) return null;
  return {
    id: event.id,
    title: event.title,
    art: event.art,
    narrative: event.narrative,
    choices: event.choices.map((choice) => hydratePersistedMysteryChoice(choice)!),
  };
}

export function hydrateMysteryVisit(data: PersistedMysteryVisit | null): HydratedMysteryVisit {
  if (!data) return emptyHydratedMysteryVisit();
  return {
    mysteryEvent: data.event,
    mysteryChosenChoice: hydratePersistedMysteryChoice(data.chosenChoice),
    mysteryCardChoices: data.cardChoices,
    mysteryGrantedTrinketIds: data.grantedTrinketIds,
    mysteryGrantedGearInstances: data.grantedGear ?? [],
    mysteryChosenCardId: data.chosenCardId,
  };
}

interface PersistedMysteryVisitInput {
  event: PersistedMysteryEventInput | MysteryEvent;
  chosenChoice?: PersistedMysteryChoiceInput | MysteryChoice | null;
  cardChoices?: readonly unknown[] | null;
  grantedTrinketIds?: readonly string[];
  grantedGear?: readonly GearInstance[];
  chosenCardId?: string | null;
}

export function hydratePersistedMysteryVisit(
  data: PersistedMysteryVisitInput | PersistedMysteryVisit | null,
): PersistedMysteryVisit | null {
  if (!data) return null;
  return {
    event: hydrateMysteryEvent(data.event)!,
    chosenChoice: hydratePersistedMysteryChoice(data.chosenChoice ?? null),
    cardChoices: data.cardChoices?.map((card) => hydrateCard(card as BattleCard)) ?? null,
    grantedTrinketIds: [...(data.grantedTrinketIds ?? [])],
    grantedGear: [...(data.grantedGear ?? [])],
    chosenCardId: data.chosenCardId ?? null,
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
