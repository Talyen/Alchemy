import type { BattleCard, KeywordId, TrinketEntry } from "@/lib/game-data";
import { sampleItems } from "./utils";

export const REWARD_TRINKET_CHANCE = 0.25;
export const REWARD_RANDOM_CHANCE = 0.3;

export function getCardKeywords(card: BattleCard): KeywordId[] {
  const keywords = new Set<KeywordId>();

  if (card.template === "nature") keywords.add("nature");
  if (card.template === "holy") keywords.add("holy");

  for (const effect of card.effects) {
    switch (effect.kind) {
      case "damage":
        keywords.add(effect.damageType);
        if (effect.lifesteal) keywords.add("leech");
        break;
      case "player-status":
        if (effect.status === "block" || effect.status === "armor" || effect.status === "forge") {
          keywords.add(effect.status);
        }
        break;
      case "heal":
        keywords.add("health");
        break;
      case "restore-mana":
      case "lose-mana":
      case "lose-max-mana":
      case "gain-max-mana":
        keywords.add("mana");
        break;
      case "gain-gold":
        keywords.add("gold");
        break;
      case "wish":
        keywords.add("wish");
        break;
      case "summon-companion":
        keywords.add("companion");
        break;
      case "remove-ailment":
        keywords.add("ailment");
        break;
    }
  }

  if (card.consume) keywords.add("consume");

  return Array.from(keywords);
}

export function selectRewardTrinkets(allTrinkets: TrinketEntry[], count: number): TrinketEntry[] {
  return sampleItems(allTrinkets, count);
}

export function selectRewardCards(deck: BattleCard[], allCards: BattleCard[], count: number): BattleCard[] {
  const candidates = allCards.filter((c) => c.id !== "mixed-potion");

  if (Math.random() < REWARD_RANDOM_CHANCE) return sampleItems(candidates, count);

  const freq: Record<string, number> = {};
  for (const card of deck) {
    for (const kw of getCardKeywords(card)) freq[kw] = (freq[kw] || 0) + 1;
  }

  const deckIds = new Set(deck.map((c) => c.id));

  const scored = candidates.map((card) => {
    let score = 0;
    for (const kw of getCardKeywords(card)) score += freq[kw] || 0;
    if (!deckIds.has(card.id)) score += 2;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const pool = scored.slice(0, Math.min(count * 2, scored.length)).map((s) => s.card);
  return sampleItems(pool, count);
}
