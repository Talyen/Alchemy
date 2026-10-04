import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { BattleCard, KeywordId } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice, MysteryEffect, MysteryEvent } from "@/lib/mystery";
import type { PersistedMysteryVisit } from "./types";
import type { ParsedActiveRunData } from "@/lib/validation";

type PersistedMysteryVisitInput = NonNullable<ParsedActiveRunData["mysteryVisit"]>;
type PersistedMysteryChoiceInput = PersistedMysteryVisitInput["event"]["choices"][number];

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

export function hydratePersistedMysteryVisit(
  data: PersistedMysteryVisitInput | PersistedMysteryVisit | null,
): PersistedMysteryVisit | null {
  if (!data) return null;
  return {
    event: { ...data.event, choices: data.event.choices.map(hydrateMysteryChoice) },
    chosenChoice: data.chosenChoice ? hydrateMysteryChoice(data.chosenChoice) : null,
    cardChoices: data.cardChoices?.map(hydrateCard) ?? null,
    grantedTrinketIds: [...(data.grantedTrinketIds ?? [])],
    grantedGear: [...(data.grantedGear ?? [])],
    chosenCardId: data.chosenCardId ?? null,
  };
}

function hydrateMysteryChoice(choice: PersistedMysteryChoiceInput): MysteryChoice {
  return {
    label: choice.label,
    effects: choice.effects.map((effect): MysteryEffect => {
      if (effect.kind === "gainXP") return { ...effect, keyword: effect.keyword as KeywordId };
      // Parsed optional fields may be explicitly undefined; live effects omit them.
      if (effect.kind === "healHealth") {
        const { chance, ...rest } = effect;
        return chance === undefined ? rest : { ...rest, chance };
      }
      if (effect.kind === "gainRandomTrinket") {
        const { fromIds, ...rest } = effect;
        return fromIds === undefined ? rest : { ...rest, fromIds };
      }
      if (effect.kind === "chooseCard")
        return effect.tag ? { kind: "chooseCard", tag: effect.tag as KeywordId } : { kind: "chooseCard" };
      if (effect.kind === "gainGeneratedGear")
        return {
          kind: effect.kind,
          baseItemId: effect.baseItemId,
          ...(effect.astral ? { astral: effect.astral } : {}),
        };
      return effect;
    }),
  };
}
