import type { BattleCard } from "@/lib/game-data";
import { getCardDisplayTitle } from "./card-description-ui";

function inspectionSortKey(card: BattleCard): string {
  return JSON.stringify([card.id, card.cost, card.effects, card.descriptionLines, card.corrupted, card.uid]);
}

export function sortInspectionCards(cards: readonly BattleCard[]): BattleCard[] {
  if (cards.length <= 1) return [...cards];
  return cards
    .map((card) => ({
      card,
      title: getCardDisplayTitle(card),
      key: inspectionSortKey(card),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "en") || a.key.localeCompare(b.key, "en"))
    .map((entry) => entry.card);
}
