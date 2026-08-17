// Runtime validation before hydration (returns ActiveRunData | null).
// Save-file legacy fixes during load use normalizeActiveRunData in @/lib/validation.
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { BattleCard } from "@/lib/game-data";
import { ActiveRunDataSchema, type ParsedActiveRunData } from "@/lib/validation";
import type { MysteryChoice } from "@/lib/mystery";

import type { ActiveRunData } from "./types";
import { hydratePersistedMysteryChoice } from "./mystery-visit-persistence";

type ParsedBattleCard = ParsedActiveRunData["runDeck"][number];

function hydrateParsedCard(card: ParsedBattleCard): BattleCard {
  return hydrateCard(card);
}

/** Maps Zod-parsed active-run output to the hydrated runtime ActiveRunData contract. */
export function toActiveRunData(parsed: ParsedActiveRunData): ActiveRunData {
  return {
    ...parsed,
    runDeck: parsed.runDeck.map(hydrateParsedCard),
    wildwoodDraft: parsed.wildwoodDraft
      ? {
          ...parsed.wildwoodDraft,
          draftChoices: parsed.wildwoodDraft.draftChoices.map(hydrateParsedCard),
        }
      : null,
    starterDraftChoices: parsed.starterDraftChoices?.map(hydrateParsedCard) ?? null,
    shopState: parsed.shopState
      ? {
          ...parsed.shopState,
          cards: parsed.shopState.cards.map(hydrateParsedCard),
        }
      : null,
    alchemistState: parsed.alchemistState
      ? {
          ...parsed.alchemistState,
          potions: parsed.alchemistState.potions.map(hydrateParsedCard),
        }
      : null,
    mysteryVisit: parsed.mysteryVisit
      ? {
          eventId: parsed.mysteryVisit.eventId,
          chosenChoice: hydratePersistedMysteryChoice(parsed.mysteryVisit.chosenChoice as MysteryChoice | null),
          pendingRemoval: parsed.mysteryVisit.pendingRemoval,
          cardChoices: parsed.mysteryVisit.cardChoices?.map(hydrateParsedCard) ?? null,
          grantedTrinketIds: parsed.mysteryVisit.grantedTrinketIds,
          grantedGear: parsed.mysteryVisit.grantedGear,
          chosenCardId: parsed.mysteryVisit.chosenCardId,
          resolvedTrinketIds: parsed.mysteryVisit.resolvedTrinketIds ?? [],
        }
      : null,
    corruptionResult: parsed.corruptionResult
      ? {
          ...parsed.corruptionResult,
          originalCard: hydrateParsedCard(parsed.corruptionResult.originalCard),
          corruptedCard: hydrateParsedCard(parsed.corruptionResult.corruptedCard),
        }
      : null,
  };
}

export function parseActiveRun(activeRun: unknown): ActiveRunData | null {
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const result = ActiveRunDataSchema.safeParse(activeRun);
  if (!result.success) {
    return null;
  }

  return toActiveRunData(result.data);
}
