// Query helpers over the card library. Re-exported by ../cards.
import { MIXED_POTION_CARD_ID, POTION_CARD_ID_SUFFIX } from "@/lib/game-constants";
import type { BattleCard } from "../types";
import { cardLibrary } from "../cards";

export function isStandardPotionCard(card: Pick<BattleCard, "id">): boolean {
  return card.id.endsWith(POTION_CARD_ID_SUFFIX) && card.id !== MIXED_POTION_CARD_ID;
}

export function getOfferableCardPool(): BattleCard[] {
  return cardLibrary.filter((card) => !card.excludeFromOfferPool);
}

export function getStandardPotionPool(): BattleCard[] {
  return cardLibrary.filter(isStandardPotionCard);
}
