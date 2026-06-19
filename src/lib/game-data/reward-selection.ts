// Core card selection helper using keyword deck affinity and tie-breaking randomness.
// Fits within src/lib/ boundaries (no imports from features/).
import { REWARD_SELECTION_CONFIG, REWARD_RANDOM_CHANCE } from "../game-constants";
import { shuffle } from "../utils";
import { getCardKeywords } from "./keywords";
import type { BattleCard, KeywordId } from "./types";

export function selectRewardCards(
  deck: BattleCard[] = [],
  allCards: BattleCard[],
  count: number,
  exclude: BattleCard[] = [],
  rng?: () => number,
  seedKeywords: KeywordId[] = [],
): BattleCard[] {
  const activeRng = rng ?? Math.random;

  // Filter out excluded cards upfront
  const candidates = allCards.filter((c) => !exclude.some((ex) => ex.id === c.id));

  // Tie-Resolution Fix: Shuffle candidates before scoring/sorting
  // to ensure that ties (e.g. no matches) are resolved randomly
  // without database/library order bias.
  const shuffledCandidates = shuffle(candidates, activeRng);
  const selected: BattleCard[] = [];

  const freq: Record<string, number> = {};
  for (const keyword of seedKeywords) {
    freq[keyword] = (freq[keyword] || 0) + 1;
  }
  for (const card of deck) {
    for (const kw of getCardKeywords(card)) {
      freq[kw] = (freq[kw] || 0) + 1;
    }
  }

  const deckIds = new Set(deck.map((c) => c.id));

  const scored = shuffledCandidates.map((card) => {
    let score = 0;
    for (const kw of getCardKeywords(card)) {
      score += freq[kw] || 0;
    }
    if (!deckIds.has(card.id)) {
      score += REWARD_SELECTION_CONFIG.newCardScoreBonus;
    }
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const affinityPool = scored
    .slice(0, Math.min(count * REWARD_SELECTION_CONFIG.affinityPoolMultiplier, scored.length))
    .map((s) => s.card);

  for (let i = 0; i < count; i++) {
    const rollRandom = activeRng() < REWARD_RANDOM_CHANCE;
    const availableAffinity = affinityPool.filter((c) => !selected.includes(c));
    const availableRandom = shuffledCandidates.filter((c) => !selected.includes(c));

    let chosenCard: BattleCard | undefined;
    if (rollRandom) {
      if (availableRandom.length > 0) {
        chosenCard = shuffle(availableRandom, activeRng)[0];
      } else if (availableAffinity.length > 0) {
        chosenCard = shuffle(availableAffinity, activeRng)[0];
      }
    } else {
      if (availableAffinity.length > 0) {
        chosenCard = shuffle(availableAffinity, activeRng)[0];
      } else if (availableRandom.length > 0) {
        chosenCard = shuffle(availableRandom, activeRng)[0];
      }
    }

    if (chosenCard) {
      selected.push(chosenCard);
    }
  }

  return selected;
}
