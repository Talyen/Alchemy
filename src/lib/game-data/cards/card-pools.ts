// Query helpers over the card library. Re-exported by ../cards.
import { MIXED_POTION_CARD_ID, POTION_CARD_ID_SUFFIX } from "@/lib/game-constants";
import type { BattleCard } from "../types";
import { cardLibrary } from "../cards";

export function isMixedPotionCard(card: Pick<BattleCard, "id">): boolean {
  return card.id === MIXED_POTION_CARD_ID || card.id.startsWith(`${MIXED_POTION_CARD_ID}-`);
}

export function isPotionCard(card: Pick<BattleCard, "id">): boolean {
  return card.id.endsWith(POTION_CARD_ID_SUFFIX) || isMixedPotionCard(card);
}

export function isStandardPotionCard(card: Pick<BattleCard, "id">): boolean {
  // Offer/reward pools exclude Mixed Potion so it only reaches decks via the alchemist.
  // Battle perks (potency, Mortar & Pestle) use isPotionCard and still apply to it.
  return card.id.endsWith(POTION_CARD_ID_SUFFIX) && !isMixedPotionCard(card);
}

// The content is static at module load; build both pools once instead of re-filtering on every call.
const offerableCardPool = cardLibrary.filter((card) => !card.excludeFromOfferPool);
const standardPotionPool = cardLibrary.filter(isStandardPotionCard);

export function getOfferableCardPool(): BattleCard[] {
  return offerableCardPool;
}

export function getStandardPotionPool(): BattleCard[] {
  return standardPotionPool;
}
