import { createMixedPotion } from "@/lib/alchemist";
import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import {
  characters,
  cloneBattleCard,
  getCardKeywords,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type CompanionId,
  type KeywordId,
} from "@/lib/game-data";
import { createSeededRng, pickRandom, sampleItems, shuffle } from "@/lib/rng";
import type { TalentPreset } from "./simulator-types";

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
    const baseA = pickRandom(pool, rng);
    const baseB = pickRandom(pool, rng);
    if (!baseA || !baseB) throw new Error("buildAlchemistMixedPotions: potion pool is empty");
    const cardA = { ...baseA, uid: i * 2 };
    const cardB = { ...baseB, uid: i * 2 + 1 };
    mixed.push(createMixedPotion(cardA, cardB));
  }
  return mixed;
}

interface ClassDeckTemplate {
  startingDeck: readonly BattleCard[];
  candidates: readonly BattleCard[];
}

const CLASS_DECK_TEMPLATES = new Map<CharacterId, ClassDeckTemplate>();

function getClassDeckTemplate(characterId: CharacterId): ClassDeckTemplate {
  let template = CLASS_DECK_TEMPLATES.get(characterId);
  if (!template) {
    const startingDeck = getStartingDeck(characterId);
    const startingIds = new Set(startingDeck.map((card) => card.id));
    const affinityKeywords = characters[characterId].keywords;
    const candidates = getOfferableCardPool().filter(
      (card) => !startingIds.has(card.id) && cardMatchesAffinity(card, affinityKeywords),
    );
    template = { startingDeck, candidates };
    CLASS_DECK_TEMPLATES.set(characterId, template);
  }
  return template;
}

export function buildClassSimDeck(characterId: CharacterId, preset: TalentPreset, seed: number): BattleCard[] {
  const rng = createSeededRng(seed);

  if (characterId === "wildcard") {
    const pool = shuffle([...getOfferableCardPool()], rng);
    return pool.slice(0, WILDCARD_SIM_DECK_SIZE[preset]).map(cloneBattleCard);
  }

  const { startingDeck, candidates } = getClassDeckTemplate(characterId);
  const picked = sampleItems(candidates, CLASS_SIM_AFFINITY_EXTRAS[preset], rng);
  // Templates hold shared catalog objects: clone on return so battle
  // mutations cannot leak across sims (see cloneBattleCard contract).
  const deck = [...startingDeck, ...picked].map(cloneBattleCard);

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
