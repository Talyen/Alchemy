// Core card selection helper using keyword deck affinity and tie-breaking randomness.
// Fits within src/lib/ boundaries (no imports from features/).
import { REWARD_SELECTION_CONFIG, REWARD_RANDOM_CHANCE } from "../game-constants";
import { shuffle } from "../utils";
import { getCardKeywords } from "./keywords";
import type { BattleCard, KeywordId } from "./types";

function buildKeywordFrequency(deck: BattleCard[], seedKeywords: KeywordId[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const keyword of seedKeywords) freq[keyword] = (freq[keyword] ?? 0) + 1;
  for (const card of deck) for (const kw of getCardKeywords(card)) freq[kw] = (freq[kw] ?? 0) + 1;
  return freq;
}

function buildAffinityPool(
  candidates: BattleCard[],
  deck: BattleCard[],
  freq: Record<string, number>,
  count: number,
  activeRng: () => number,
): BattleCard[] {
  const deckIds = new Set(deck.map((c) => c.id));
  const shuffledCandidates = shuffle(candidates, activeRng);
  const scored = shuffledCandidates.map((card) => {
    let score = 0;
    for (const kw of getCardKeywords(card)) score += freq[kw] ?? 0;
    if (!deckIds.has(card.id)) score += REWARD_SELECTION_CONFIG.newCardScoreBonus;
    return { card, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, Math.min(count * REWARD_SELECTION_CONFIG.affinityPoolMultiplier, scored.length))
    .map((s) => s.card);
}

function pickOneCard(
  pool: BattleCard[],
  shuffledCandidates: BattleCard[],
  selected: BattleCard[],
  activeRng: () => number,
): BattleCard | undefined {
  const rollRandom = activeRng() < REWARD_RANDOM_CHANCE;
  const availableAffinity = pool.filter((c) => !selected.includes(c));
  const availableRandom = shuffledCandidates.filter((c) => !selected.includes(c));
  const primary = rollRandom ? availableRandom : availableAffinity;
  const fallback = rollRandom ? availableAffinity : availableRandom;
  if (primary.length > 0) return shuffle(primary, activeRng)[0];
  if (fallback.length > 0) return shuffle(fallback, activeRng)[0];
  return undefined;
}

export function selectRewardCards(
  deck: BattleCard[] = [],
  allCards: BattleCard[],
  count: number,
  exclude: BattleCard[] = [],
  rng?: () => number,
  seedKeywords: KeywordId[] = [],
): BattleCard[] {
  const activeRng = rng ?? Math.random;
  const candidates = allCards.filter((c) => !exclude.some((ex) => ex.id === c.id));
  const shuffledCandidates = shuffle(candidates, activeRng);
  const selected: BattleCard[] = [];
  const freq = buildKeywordFrequency(deck, seedKeywords);
  const affinityPool = buildAffinityPool(candidates, deck, freq, count, activeRng);

  for (let i = 0; i < count; i++) {
    const chosenCard = pickOneCard(affinityPool, shuffledCandidates, selected, activeRng);
    if (chosenCard) selected.push(chosenCard);
  }

  return selected;
}
