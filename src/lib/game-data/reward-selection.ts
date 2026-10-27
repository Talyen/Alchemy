import { REWARD_SELECTION_CONFIG, REWARD_RANDOM_CHANCE_FRACTION } from "../game-constants";
import { pickRandom, shuffle } from "@/lib/rng";
import { getCardKeywords } from "./keywords";
import { isCompanionSummonCard } from "./cards/card-pools";
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
  companionScoreBonus: number,
): BattleCard[] {
  const deckIds = deck.length ? new Set<string>() : undefined;
  if (deckIds) for (const card of deck) deckIds.add(card.id);
  const shuffledCandidates = shuffle(candidates, activeRng);
  const scoreCard = (card: BattleCard): number => {
    let score = 0;
    for (const kw of getCardKeywords(card)) score += freq[kw] ?? 0;
    if (!deckIds?.has(card.id)) score += REWARD_SELECTION_CONFIG.newCardScoreBonus;
    if (companionScoreBonus > 0 && isCompanionSummonCard(card)) score += companionScoreBonus;
    return score;
  };
  const poolSize = Math.floor(Math.min(count * REWARD_SELECTION_CONFIG.affinityPoolMultiplier, candidates.length));
  // Stable sorting preserves shuffled ties and the subsequent run RNG position.
  const scored = shuffledCandidates.map((card) => ({ card, score: scoreCard(card) }));
  scored.sort((a, b) => b.score - a.score);
  const result: BattleCard[] = [];
  for (let index = 0; index < poolSize; index++) result.push(scored[index]!.card);
  return result;
}

function dampenCompanionCandidates(candidates: BattleCard[], rng: () => number): BattleCard[] {
  return candidates.filter(
    (card) => !isCompanionSummonCard(card) || rng() < REWARD_SELECTION_CONFIG.companionOwnedKeepFraction,
  );
}

function removeChosenCard(pool: BattleCard[], id: string): void {
  // Both pools are owned by this reward selection. Compact in order so
  // weighted duplicates and seeded picks match filtering, without new arrays.
  let kept = 0;
  for (const card of pool) {
    if (card.id === id) continue;
    pool[kept++] = card;
  }
  pool.length = kept;
}

export function selectRewardCards(
  deck: BattleCard[] = [],
  allCards: BattleCard[],
  count: number,
  exclude: BattleCard[] = [],
  rng: () => number,
  seedKeywords: KeywordId[] = [],
): BattleCard[] {
  if (count <= 0) return [];
  const excludedIds = exclude.length ? new Set<string>() : null;
  if (excludedIds) for (const card of exclude) excludedIds.add(card.id);
  const pool = excludedIds ? allCards.filter((card) => !excludedIds.has(card.id)) : allCards;
  if (pool.length === 0) return [];
  const hasCompanion = deck.some(isCompanionSummonCard);
  // A Companion-only Wish still offers all its choices when the deck already
  // contains summons; dampening belongs to mixed reward pools.
  const candidates = hasCompanion && !pool.every(isCompanionSummonCard) ? dampenCompanionCandidates(pool, rng) : pool;
  const effectiveCandidates = candidates.length > 0 ? candidates : pool;
  const boostCompanions = !hasCompanion;
  const companionCopies = boostCompanions ? REWARD_SELECTION_CONFIG.companionlessRandomWeight : 1;
  const weightedCandidates = companionCopies > 1 ? [...effectiveCandidates] : effectiveCandidates;
  if (companionCopies > 1) {
    for (const card of effectiveCandidates) if (isCompanionSummonCard(card)) weightedCandidates.push(card);
  }
  const randomPool = shuffle(weightedCandidates, rng);
  const selected: BattleCard[] = [];
  const freq = buildKeywordFrequency(deck, seedKeywords);
  const affinityPool = buildAffinityPool(
    effectiveCandidates,
    deck,
    freq,
    count,
    rng,
    boostCompanions ? REWARD_SELECTION_CONFIG.companionlessScoreBonus : 0,
  );

  for (let i = 0; i < count; i++) {
    const preferredPool = rng() >= REWARD_RANDOM_CHANCE_FRACTION ? affinityPool : randomPool;
    const chosenCard = pickRandom(preferredPool.length > 0 ? preferredPool : randomPool, rng);
    if (!chosenCard) break;
    selected.push(chosenCard);
    removeChosenCard(affinityPool, chosenCard.id);
    removeChosenCard(randomPool, chosenCard.id);
  }

  // Ownership changes preference, not the number of promised choices.
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((card) => card.id));
    for (const card of shuffle(
      pool.filter((candidate) => !selectedIds.has(candidate.id)),
      rng,
    )) {
      if (selectedIds.has(card.id)) continue;
      selected.push(card);
      selectedIds.add(card.id);
      if (selected.length >= count) break;
    }
  }

  return selected;
}
