import { hydrateAlchemyVisit } from "./alchemy-visits";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { ActiveRunDataSchema, type ParsedActiveRunData } from "@/lib/validation";

import type { ActiveRunData } from "./types";
import { hydratePersistedMysteryVisit } from "./mystery-visit-persistence";

export function toActiveRunData(parsed: ParsedActiveRunData): ActiveRunData {
  return {
    ...parsed,
    runDeck: parsed.runDeck.map(hydrateCard),
    campfireState: hydrateAlchemyVisit(parsed.campfireState),
    transmutationState: hydrateAlchemyVisit(parsed.transmutationState),
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
    mysteryVisit: hydratePersistedMysteryVisit(parsed.mysteryVisit),
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
  // Validation + hydration entry (used by tests and standalone parsing).
  // The load path in storage/save-candidates.ts validates the full save
  // envelope first and then calls toActiveRunData directly, so this stays as
  // the single active-run parse owner rather than duplicating that path.
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const result = ActiveRunDataSchema.safeParse(activeRun);
  if (!result.success) {
    return null;
  }

  return toActiveRunData(result.data);
}
