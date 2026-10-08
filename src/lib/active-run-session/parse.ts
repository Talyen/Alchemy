import { hydrateAlchemyVisit } from "./alchemy-visits";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { ActiveRunDataSchema, type ParsedActiveRunData } from "@/lib/validation";
import type { ActiveRunData, PersistedRunActivity } from "./types";
import { hydratePersistedMysteryVisit } from "./mystery-visit-persistence";

function hydrateActivity(activity: ParsedActiveRunData["activity"]): PersistedRunActivity {
  switch (activity.kind) {
    case "shop":
      return { ...activity, data: { ...activity.data, cards: activity.data.cards.map(hydrateCard) } };
    case "alchemist":
      return { ...activity, data: { ...activity.data, potions: activity.data.potions.map(hydrateCard) } };
    case "mystery":
      return { ...activity, data: hydratePersistedMysteryVisit(activity.data) };
    case "campfire":
    case "transmutation":
      return { ...activity, data: hydrateAlchemyVisit(activity.data)! };
    case "corruption":
      return {
        ...activity,
        data: activity.data
          ? {
              ...activity.data,
              originalCard: hydrateCard(activity.data.originalCard),
              corruptedCard: hydrateCard(activity.data.corruptedCard),
            }
          : null,
      };
    case "battle":
    case "rewards":
    case "destination":
    case "trinket-shop":
    case "equipment-shop":
    case "draft-deck":
    case "difficulty-select":
    case "labyrinth-map":
    case "wildwood-removal":
      return activity;
    default:
      throw new Error("Unknown saved activity");
  }
}
export function toActiveRunData(parsed: ParsedActiveRunData): ActiveRunData {
  return {
    ...parsed,
    runDeck: parsed.runDeck.map(hydrateCard),
    activity: hydrateActivity(parsed.activity),
    wildwoodDraft: parsed.wildwoodDraft
      ? { ...parsed.wildwoodDraft, draftChoices: parsed.wildwoodDraft.draftChoices.map(hydrateCard) }
      : null,
    starterDraftChoices: parsed.starterDraftChoices?.map(hydrateCard) ?? null,
  };
}
export function parseActiveRun(activeRun: unknown): ActiveRunData | null {
  const result = ActiveRunDataSchema.safeParse(activeRun);
  return result.success ? toActiveRunData(result.data) : null;
}
