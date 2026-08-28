import type { KeywordId } from "@/lib/game-data";

export const keywordAliases: Array<{ match: string; keywordId: KeywordId }> = [
  { match: "Physical", keywordId: "physical" },
  { match: "Stun", keywordId: "stun" },
  { match: "Stunned", keywordId: "stun" },
  { match: "Block", keywordId: "block" },
  { match: "Forge", keywordId: "forge" },
  { match: "Armor", keywordId: "armor" },
  { match: "Health", keywordId: "health" },
  { match: "Gold", keywordId: "gold" },
  { match: "Holy", keywordId: "holy" },
  { match: "Wish", keywordId: "wish" },
  { match: "Consume", keywordId: "consume" },
  { match: "Poison", keywordId: "poison" },
  { match: "Poisoned", keywordId: "poison" },
  { match: "Bleed", keywordId: "bleed" },
  { match: "Bleeds", keywordId: "bleed" },
  { match: "Bleeding", keywordId: "bleed" },
  { match: "Leech", keywordId: "leech" },
  { match: "Leeches", keywordId: "leech" },
  { match: "Leeching", keywordId: "leech" },
  { match: "Freeze", keywordId: "freeze" },
  { match: "Freezes", keywordId: "freeze" },
  { match: "Frozen", keywordId: "freeze" },
  { match: "Burn", keywordId: "burn" },
  { match: "Burns", keywordId: "burn" },
  { match: "Burning", keywordId: "burn" },
  { match: "Companion", keywordId: "companion" },
  { match: "Companions", keywordId: "companion" },
  { match: "Mana Crystal", keywordId: "mana" },
  { match: "Mana", keywordId: "mana" },
  { match: "Nature", keywordId: "nature" },
  { match: "Archery", keywordId: "archery" },
];

export const keywordAliasMap = new Map<string, KeywordId>(
  keywordAliases.map((alias) => [alias.match.toLowerCase(), alias.keywordId]),
);

export const keywordPattern = new RegExp(
  `\\b(${keywordAliases
    .map((alias) => alias.match.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
    .sort((left, right) => right.length - left.length)
    .join("|")})\\b`,
  "gi",
);

export function extractKeywordIds(text: string): KeywordId[] {
  const keywords = new Set<KeywordId>();
  for (const match of text.matchAll(keywordPattern)) {
    const keywordId = keywordAliasMap.get(match[0].toLowerCase());
    if (keywordId) keywords.add(keywordId);
  }
  return Array.from(keywords);
}
