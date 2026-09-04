import { REWARD_SELECTION_CONFIG, REWARD_RANDOM_CHANCE } from "../game-constants";
import { pickRandom, shuffle } from "@/lib/utils";
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
  const scored = shuffledCandidates.map((card) => {
    let score = 0;
    for (const kw of getCardKeywords(card)) score += freq[kw] ?? 0;
    if (!deckIds.has(card.id)) score += REWARD_SELECTION_CONFIG.newCardScoreBonus;
    if (companionScoreBonus > 0 && isCompanionCard(card)) score += companionScoreBonus;
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
  if (primary.length > 0) return pickRandom(primary, activeRng);
  if (fallback.length > 0) return pickRandom(fallback, activeRng);
  return undefined;
}

export function selectRewardCards(
  deck: BattleCard[] = [],
  allCards: BattleCard[],
  count: number,
  exclude: BattleCard[] = [],
  rng: () => number,
  seedKeywords: KeywordId[] = [],
): BattleCard[] {
  const activeRng = rng;
  const candidates = allCards.filter((c) => !exclude.some((ex) => ex.id === c.id));
  const boostCompanions = !deckHasCompanionCard(deck);
  const companionCopies = boostCompanions ? REWARD_SELECTION_CONFIG.companionlessRandomWeight : 1;
  const shuffledCandidates = shuffle(
    companionCopies > 1 ? [...candidates, ...candidates.filter(isCompanionCard)] : candidates,
    activeRng,
  );
  const selected: BattleCard[] = [];
  const freq = buildKeywordFrequency(deck, seedKeywords);
  const affinityPool = buildAffinityPool(
    candidates,
    deck,
    freq,
    count,
    activeRng,
    boostCompanions ? REWARD_SELECTION_CONFIG.companionlessScoreBonus : 0,
  );

  for (let i = 0; i < count; i++) {
    const chosenCard = pickOneCard(affinityPool, shuffledCandidates, selected, activeRng);
    if (chosenCard) selected.push(chosenCard);
  }

  return selected;
}
