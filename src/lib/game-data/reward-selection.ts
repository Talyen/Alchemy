import { REWARD_SELECTION_CONFIG, REWARD_RANDOM_CHANCE_FRACTION } from "../game-constants";
import { pickRandom, shuffle } from "@/lib/rng";
import { getCardKeywords } from "./keywords";
import type { BattleCard, KeywordId } from "./types";

function isCompanionCard(card: Pick<BattleCard, "effects">): boolean {
  return card.effects?.some((effect) => effect.kind === "summon-companion") ?? false;
}

export function deckHasCompanionCard(deck: ReadonlyArray<Pick<BattleCard, "effects">>): boolean {
  return deck.some(isCompanionCard);
}

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
  const deckIds = new Set(deck.map((c) => c.id));
  const shuffledCandidates = shuffle(candidates, activeRng);
  const scoreCard = (card: BattleCard): number => {
    let score = 0;
    for (const kw of getCardKeywords(card)) score += freq[kw] ?? 0;
    if (!deckIds.has(card.id)) score += REWARD_SELECTION_CONFIG.newCardScoreBonus;
    if (companionScoreBonus > 0 && isCompanionCard(card)) score += companionScoreBonus;
    return score;
  };
  const poolSize = Math.min(count * REWARD_SELECTION_CONFIG.affinityPoolMultiplier, candidates.length);
  // Ordinary rewards retain only a handful of cards. Keep the shuffled order
  // for ties, just like the stable sort, without scoring objects for the catalog.
  // Larger requests use sorting to avoid quadratic insertion work.
  if (poolSize > 0 && poolSize <= 16) {
    const limit = Math.floor(poolSize);
    const cards: BattleCard[] = [];
    const scores: number[] = [];
    for (const card of shuffledCandidates) {
      const score = scoreCard(card);
      if (cards.length === limit && score <= scores[limit - 1]!) continue;
      let index = cards.length;
      while (index > 0 && score > scores[index - 1]!) index--;
      if (index >= limit) continue;
      cards.splice(index, 0, card);
      scores.splice(index, 0, score);
      if (cards.length > limit) {
        cards.pop();
        scores.pop();
      }
    }
    return cards;
  }
  const scored = shuffledCandidates.map((card) => ({ card, score: scoreCard(card) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, poolSize).map((s) => s.card);
}

function dampenCompanionCandidates(candidates: BattleCard[], rng: () => number): BattleCard[] {
  return candidates.filter(
    (card) => !isCompanionCard(card) || rng() < REWARD_SELECTION_CONFIG.companionOwnedKeepFraction,
  );
}

function pruneSelectedCards(pool: BattleCard[], selectedIds: ReadonlySet<string>): void {
  if (selectedIds.size === 0) return;
  // Both pools are owned by this reward selection. Compact in order so
  // weighted duplicates and seeded picks match filtering, without new arrays.
  let kept = 0;
  for (const card of pool) {
    if (selectedIds.has(card.id)) continue;
    pool[kept++] = card;
  }
  pool.length = kept;
}

function pickOneCard(
  affinityPool: BattleCard[],
  randomPool: BattleCard[],
  selectedIds: ReadonlySet<string>,
  rng: () => number,
): BattleCard | undefined {
  if (rng() >= REWARD_RANDOM_CHANCE_FRACTION) {
    pruneSelectedCards(affinityPool, selectedIds);
    if (affinityPool.length > 0) return pickRandom(affinityPool, rng);
  }
  pruneSelectedCards(randomPool, selectedIds);
  return pickRandom(randomPool, rng);
}

export function selectRewardCards(
  deck: BattleCard[] = [],
  allCards: BattleCard[],
  count: number,
  exclude: BattleCard[] = [],
  rng: () => number,
  seedKeywords: KeywordId[] = [],
): BattleCard[] {
  const excludedIds = new Set(exclude.map((card) => card.id));
  const pool = allCards.filter((card) => !excludedIds.has(card.id));
  const hasCompanion = deckHasCompanionCard(deck);
  const candidates = hasCompanion ? dampenCompanionCandidates(pool, rng) : pool;
  const effectiveCandidates = candidates.length > 0 ? candidates : pool;
  const boostCompanions = !hasCompanion;
  const companionCopies = boostCompanions ? REWARD_SELECTION_CONFIG.companionlessRandomWeight : 1;
  const randomPool = shuffle(
    companionCopies > 1
      ? [...effectiveCandidates, ...effectiveCandidates.filter(isCompanionCard)]
      : effectiveCandidates,
    rng,
  );
  const selected: BattleCard[] = [];
  const selectedIds = new Set<string>();
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
    const chosenCard = pickOneCard(affinityPool, randomPool, selectedIds, rng);
    if (chosenCard) {
      selected.push(chosenCard);
      selectedIds.add(chosenCard.id);
    }
  }

  return selected;
}
