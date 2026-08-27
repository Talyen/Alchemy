// Runtime validation before hydration (returns ActiveRunData | null).
// Save-file legacy fixes during load use normalizeActiveRunData in @/lib/validation.
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { ActiveRunDataSchema, type ParsedActiveRunData } from "@/lib/validation";

import type { ActiveRunData } from "./types";
import { hydratePersistedMysteryChoice } from "./mystery-visit-persistence";

/** Maps Zod-parsed active-run output to the hydrated runtime ActiveRunData contract. */
export function toActiveRunData(parsed: ParsedActiveRunData): ActiveRunData {
  return {
    ...parsed,
    runDeck: parsed.runDeck.map(hydrateCard),
    wildwoodDraft: parsed.wildwoodDraft
      ? {
          ...parsed.wildwoodDraft,
          draftChoices: parsed.wildwoodDraft.draftChoices.map(hydrateCard),
        }
      : null,
    starterDraftChoices: parsed.starterDraftChoices?.map(hydrateCard) ?? null,
    shopState: parsed.shopState
      ? {
          ...parsed.shopState,
          cards: parsed.shopState.cards.map(hydrateCard),
        }
      : null,
    alchemistState: parsed.alchemistState
      ? {
          ...parsed.alchemistState,
          potions: parsed.alchemistState.potions.map(hydrateCard),
        }
      : null,
    mysteryVisit: parsed.mysteryVisit
      ? {
          eventId: parsed.mysteryVisit.eventId,
          chosenChoice: hydratePersistedMysteryChoice(parsed.mysteryVisit.chosenChoice),
          ...(parsed.mysteryVisit.pendingRemoval ? { pendingRemoval: true } : {}),
          cardChoices: parsed.mysteryVisit.cardChoices?.map(hydrateCard) ?? null,
          grantedTrinketIds: parsed.mysteryVisit.grantedTrinketIds,
          grantedGear: parsed.mysteryVisit.grantedGear,
          chosenCardId: parsed.mysteryVisit.chosenCardId,
          resolvedTrinketIds: parsed.mysteryVisit.resolvedTrinketIds ?? [],
        }
      : null,
    corruptionResult: parsed.corruptionResult
      ? {
          ...parsed.corruptionResult,
          originalCard: hydrateCard(parsed.corruptionResult.originalCard),
          corruptedCard: hydrateCard(parsed.corruptionResult.corruptedCard),
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
