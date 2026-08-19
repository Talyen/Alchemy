// Class-identity deck builder for balance simulations.
import { createMixedPotion } from "@/lib/alchemist/potion-mixer";
import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import {
  characters,
  getCardKeywords,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type CompanionId,
  type KeywordId,
} from "@/lib/game-data";
import { createSeededRng, sampleItems, shuffle } from "@/lib/utils";
import type { TalentPreset } from "./types";

const ALCHEMIST_MIXED_POTION_COUNT = 2;

export const CLASS_SIM_AFFINITY_EXTRAS: Record<TalentPreset, number> = {
  early: 1,
  mid: 3,
  late: 5,
};

export const WILDCARD_SIM_DECK_SIZE: Record<TalentPreset, number> = {
  early: 8,
  mid: 10,
  late: 13,
};

export function cardMatchesAffinity(card: BattleCard, affinityKeywords: readonly KeywordId[]): boolean {
  if (affinityKeywords.length === 0) return true;
  const cardKeywords = getCardKeywords(card);
  return affinityKeywords.some((keyword) => cardKeywords.includes(keyword));
}

function buildAlchemistMixedPotions(seed: number): BattleCard[] {
  const pool = getStandardPotionPool();
  const rng = createSeededRng(seed + 9_001);
  const mixed: BattleCard[] = [];
  for (let i = 0; i < ALCHEMIST_MIXED_POTION_COUNT; i++) {
    const cardA = { ...pool[Math.floor(rng() * pool.length)]!, uid: i * 2 };
    const cardB = { ...pool[Math.floor(rng() * pool.length)]!, uid: i * 2 + 1 };
    mixed.push(createMixedPotion(cardA, cardB));
  }
  return mixed;
}

export function buildClassSimDeck(characterId: CharacterId, preset: TalentPreset, seed: number): BattleCard[] {
  const rng = createSeededRng(seed);

  if (characterId === "wildcard") {
    const pool = shuffle([...getOfferableCardPool()], rng);
    return pool.slice(0, WILDCARD_SIM_DECK_SIZE[preset]);
  }

  const startingDeck = getStartingDeck(characterId);
  const startingIds = new Set(startingDeck.map((card) => card.id));
  const affinityKeywords = characters[characterId].keywords;
  const candidates = getOfferableCardPool().filter(
    (card) => !startingIds.has(card.id) && cardMatchesAffinity(card, affinityKeywords),
  );
  const picked = sampleItems(candidates, CLASS_SIM_AFFINITY_EXTRAS[preset], rng);
  const deck = [...startingDeck, ...picked];

  if (characterId === "alchemist") {
    return [...deck, ...buildAlchemistMixedPotions(seed)];
  }

  return deck;
}

export function insertCardIntoDeck(deck: readonly BattleCard[], card: BattleCard): BattleCard[] {
  if (deck.some((entry) => entry.id === card.id)) return [...deck];
  return [...deck, card];
}

export function removeCardIdFromDeck(deck: readonly BattleCard[], cardId: string): BattleCard[] {
  return deck.filter((card) => card.id !== cardId);
}

export function removeCompanionSummonFromDeck(deck: readonly BattleCard[], companionId: CompanionId): BattleCard[] {
  return deck.filter(
    (card) => !card.effects.some((effect) => effect.kind === "summon-companion" && effect.companionId === companionId),
  );
}
