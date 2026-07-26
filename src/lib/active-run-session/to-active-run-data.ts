// Maps Zod-parsed active-run output to the hydrated runtime ActiveRunData contract.
// Strips BattleCardSchema *FullyValid flags via hydrateCard so stores never see them.
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { BattleCard } from "@/lib/game-data/types";
import type { ParsedActiveRunData } from "@/lib/validation";

import type { ActiveRunData } from "./types";

type ParsedBattleCard = ParsedActiveRunData["runDeck"][number];

function hydrateParsedCard(card: ParsedBattleCard): BattleCard {
  return hydrateCard(card);
}

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
  };
}
