import type { BattleCard } from "@/lib/game-data";
import { getCardDisplayTitle } from "./card-description-ui";

function inspectionSortKey(card: BattleCard): string {
  return JSON.stringify([card.id, card.cost, card.effects, card.descriptionLines, card.corrupted, card.uid]);
}

export function sortInspectionCards(cards: readonly BattleCard[]): BattleCard[] {
  return [...cards].sort(
    (a, b) =>
      getCardDisplayTitle(a).localeCompare(getCardDisplayTitle(b), "en") ||
      inspectionSortKey(a).localeCompare(inspectionSortKey(b), "en"),
  );
}
