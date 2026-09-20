import { getImmediateDamage, getImmediateDefense } from "@/lib/battle";
import { characters, getCardKeywords, type BattleCard, type CharacterId, type KeywordId } from "@/lib/game-data";

function keywordProfile(deck: readonly BattleCard[]): Map<KeywordId, number> {
  const profile = new Map<KeywordId, number>();
  for (const card of deck)
    for (const keyword of getCardKeywords(card)) profile.set(keyword, (profile.get(keyword) ?? 0) + 1);
  return profile;
}

function heroAffinity(hero: CharacterId, keywords: readonly KeywordId[]): number {
  return keywords.filter((keyword) => characters[hero].keywords.includes(keyword)).length;
}

function deckSynergy(profile: Map<KeywordId, number>, keywords: readonly KeywordId[]): number {
  return keywords.reduce((score, keyword) => score + (profile.get(keyword) ?? 0), 0);
}

/**
 * Strategy-only scoring for non-combat decisions. It never changes gameplay
 * rules; it only gives the headless actor a deck-aware fallback when a hero's
 * static keyword catalog is sparse, especially for Wildcard.
 */
export function scoreArchetypeCard(hero: CharacterId, card: BattleCard, deck: readonly BattleCard[]): number {
  const keywords = getCardKeywords(card);
  const profile = keywordProfile(deck);
  const affinity = heroAffinity(hero, keywords);
  const synergy = deckSynergy(profile, keywords);
  const immediateDamage = getImmediateDamage(card);
  const immediateDefense = getImmediateDefense(card);
  const utility = characters[hero].keywords.length
    ? immediateDamage * 0.05 + immediateDefense * 0.08
    : immediateDamage + immediateDefense * 0.75;
  const consumePenalty = hero === "wildcard" && card.consume ? 4 : 0;
  return affinity * 4 + synergy * 1.5 + utility - consumePenalty;
}

function scoreArchetypeKeyword(hero: CharacterId, keyword: KeywordId, deck: readonly BattleCard[]): number {
  const profile = keywordProfile(deck);
  return (characters[hero].keywords.includes(keyword) ? 4 : 0) + (profile.get(keyword) ?? 0) * 1.5;
}

export function scoreStrategyCard(
  policy: "archetype" | "random" | "minimalist",
  hero: CharacterId,
  card: BattleCard,
  deck: readonly BattleCard[],
): number {
  if (policy === "archetype") return scoreArchetypeCard(hero, card, deck);
  return heroAffinity(hero, getCardKeywords(card));
}

export function scoreStrategyKeyword(
  policy: "archetype" | "random" | "minimalist",
  hero: CharacterId,
  keyword: KeywordId,
  deck: readonly BattleCard[],
): number {
  if (policy === "archetype") return scoreArchetypeKeyword(hero, keyword, deck);
  return characters[hero].keywords.includes(keyword) ? 1 : 0;
}

export function scoreArchetypeRemoval(hero: CharacterId, card: BattleCard, deck: readonly BattleCard[]): number {
  return 2 - scoreArchetypeCard(hero, card, deck);
}
