// Reward selection helpers for deck keyword affinity and trinket/card sampling.
// Depends on battle card/trinket shapes and shared sampling utilities.
// Used by run navigation after combat victories and other reward-generating screens.
import { getCardKeywords as getCardKeywordsShared, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { sampleItems } from "./utils";

export const REWARD_TRINKET_CHANCE = 0.25;
export const REWARD_RANDOM_CHANCE = 0.3;

export function getCardKeywords(card: BattleCard) {
  return getCardKeywordsShared(card);
}

export function selectRewardTrinkets(allTrinkets: TrinketEntry[], count: number): TrinketEntry[] {
  return sampleItems(allTrinkets, count);
}

export function selectRewardCards(deck: BattleCard[], allCards: BattleCard[], count: number): BattleCard[] {
  // Rewards are usually biased toward keywords already present in the deck, but occasional
  // random offers and a small new-card bonus keep drafts from becoming too deterministic.
  const candidates = allCards.filter((c) => c.id !== MIXED_POTION_CARD_ID);

  if (Math.random() < REWARD_RANDOM_CHANCE) return sampleItems(candidates, count);

  const freq: Record<string, number> = {};
  for (const card of deck) {
    for (const kw of getCardKeywords(card)) freq[kw] = (freq[kw] || 0) + 1;
  }

  const deckIds = new Set(deck.map((c) => c.id));

  const scored = candidates.map((card) => {
    let score = 0;
    for (const kw of getCardKeywords(card)) score += freq[kw] || 0;
    if (!deckIds.has(card.id)) score += 2;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const pool = scored.slice(0, Math.min(count * 2, scored.length)).map((s) => s.card);
  return sampleItems(pool, count);
}
