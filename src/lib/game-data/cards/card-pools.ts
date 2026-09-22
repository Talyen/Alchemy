import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import type { BattleCard } from "../types";
import { cardLibrary } from "./library/cards";

export function isMixedPotionCard(card: Pick<BattleCard, "id">): boolean {
  return card.id === MIXED_POTION_CARD_ID || card.id.startsWith(`${MIXED_POTION_CARD_ID}-`);
}

// Distillation ("Potions you Consume are 10% more potent") applies to exactly
// these cards. Membership is an explicit list — not a name-suffix rule — so a
// future card cannot opt into potion scaling by accident, and the similar
// one-use cards Mana Berries, Mana Crystals, Apple, and Bread stay excluded.
const POTION_CARD_IDS: ReadonlySet<string> = new Set([
  "health-potion",
  "mana-potion",
  "panacea-potion",
  "stoneskin-potion",
  "acid-potion",
  "luck-potion",
  "wishing-potion",
]);

export function isPotionCard(card: Pick<BattleCard, "id">): boolean {
  return POTION_CARD_IDS.has(card.id) || isMixedPotionCard(card);
}

export function isStandardPotionCard(card: Pick<BattleCard, "id">): boolean {
  return POTION_CARD_IDS.has(card.id);
}

const offerableCardPool = cardLibrary.filter((card) => !card.excludeFromOfferPool);
const standardPotionPool = cardLibrary.filter(isStandardPotionCard);

export function getOfferableCardPool(): BattleCard[] {
  return [...offerableCardPool];
}

export function getStandardPotionPool(): BattleCard[] {
  return [...standardPotionPool];
}
