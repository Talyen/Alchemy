import type { BattleCard } from "@/lib/game-data";
import { getCardDisplayTitle } from "../cards/card-description-ui";

const inspectionCollator = new Intl.Collator("en");

function inspectionSortKey(card: BattleCard): string {
  return JSON.stringify([card.id, card.cost, card.effects, card.descriptionLines, card.corrupted, card.uid]);
}

export function sortInspectionCards(cards: readonly BattleCard[]): BattleCard[] {
  if (cards.length <= 1) return [...cards];
  return cards
    .map((card) => ({
      card,
      title: getCardDisplayTitle(card),
      key: undefined as string | undefined,
    }))
    .sort((a, b) => {
      const titleOrder = inspectionCollator.compare(a.title, b.title);
      if (titleOrder) return titleOrder;
      // Serialize effects and descriptions only for title ties, once per entry in this sort.
      a.key ??= inspectionSortKey(a.card);
      b.key ??= inspectionSortKey(b.card);
      return inspectionCollator.compare(a.key, b.key);
    })
    .map((entry) => entry.card);
}
