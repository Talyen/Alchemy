// Reward selection helpers for deck keyword affinity and trinket/card sampling.
// Depends on battle card/trinket shapes and shared sampling utilities.
// Used by run navigation after combat victories and other reward-generating screens.
import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import { REWARD_SELECTION_CONFIG, REWARD_RANDOM_CHANCE } from "@/lib/game-constants";
import { sampleItems } from "@/features/alchemy/shared/utils";

export function selectRewardCards(deck: BattleCard[], allCards: BattleCard[], count: number): BattleCard[] {
  // Rewards are usually biased toward keywords already present in the deck, but occasional
  // random offers and a small new-card bonus keep drafts from becoming too deterministic.
  // Callers should pass getOfferableCardPool() (excludes mixed potion).
  const candidates = allCards;

  if (Math.random() < REWARD_RANDOM_CHANCE) return sampleItems(candidates, count);

  const freq: Record<string, number> = {};
  for (const card of deck) {
    for (const kw of getCardKeywords(card)) freq[kw] = (freq[kw] || 0) + 1;
  }

  const deckIds = new Set(deck.map((c) => c.id));

  const scored = candidates.map((card) => {
    let score = 0;
    for (const kw of getCardKeywords(card)) score += freq[kw] || 0;
    if (!deckIds.has(card.id)) score += REWARD_SELECTION_CONFIG.newCardScoreBonus;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const pool = scored
    .slice(0, Math.min(count * REWARD_SELECTION_CONFIG.affinityPoolMultiplier, scored.length))
    .map((s) => s.card);
  return sampleItems(pool, count);
}
