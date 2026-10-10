import {
  characters,
  cloneBattleCard,
  getCardKeywords,
  getOfferableCardPool,
  isMixedPotionCard,
  keywordDefinitions,
  type BattleCard,
  type CharacterId,
  type KeywordId,
} from "@/lib/game-data";
import type { AlchemyVisit, TransmutationChoice } from "@/lib/active-run-session/alchemy-visits";
import { sampleItems } from "@/lib/rng";

export function isTransmutableCard(card: BattleCard): boolean {
  return !isMixedPotionCard(card);
}

export function createTransmutationOffers(characterId: CharacterId, rng: () => number): TransmutationChoice[] {
  const catalog = getOfferableCardPool();
  const pools = new Map<KeywordId, BattleCard[]>();
  for (const keyword of Object.keys(keywordDefinitions) as KeywordId[]) {
    const pool = catalog.filter((card) => getCardKeywords(card).includes(keyword));
    // Four candidates leave three distinct outcomes even when the source is in the pool.
    if (pool.length >= 4) pools.set(keyword, pool);
  }
  const affinity = characters[characterId].keywords;
  const keywords = affinity.length ? affinity : sampleItems([...pools.keys()], 3, rng);
  return keywords.flatMap((keyword) => {
    const pool = pools.get(keyword);
    return pool ? [{ keyword, candidates: sampleItems(pool, 4, rng).map(cloneBattleCard) }] : [];
  });
}

export function getTransmutationOffers(visit: AlchemyVisit): BattleCard[] {
  const selection = visit.transmutation;
  if (!selection?.source || !selection.keyword) return [];
  return getTransmutationChoiceOffers(selection.choices, selection.source, selection.keyword);
}

function getTransmutationChoiceOffers(
  choices: readonly TransmutationChoice[],
  source: BattleCard,
  keyword: KeywordId,
): BattleCard[] {
  const choice = choices.find((entry) => entry.keyword === keyword);
  return choice?.candidates.filter((card) => card.id !== source.id).slice(0, 3) ?? [];
}

export function canTransmuteCard(choices: readonly TransmutationChoice[], card: BattleCard): boolean {
  return (
    isTransmutableCard(card) &&
    choices.length === 3 &&
    choices.every((choice) => getTransmutationChoiceOffers(choices, card, choice.keyword).length === 3)
  );
}

export function isTransmutationSourceCurrent(visit: AlchemyVisit, deck: readonly BattleCard[]): boolean {
  const selection = visit.transmutation;
  const source =
    selection?.sourceIndex === null || selection?.sourceIndex === undefined ? undefined : deck[selection.sourceIndex];
  return !!source && JSON.stringify(source) === JSON.stringify(selection?.source);
}
