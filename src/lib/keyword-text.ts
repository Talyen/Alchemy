import type { KeywordId } from "@/lib/game-data";

export const keywordAliases: Array<{ match: string; keywordId: KeywordId }> = [
  { match: "Dodge", keywordId: "dodge" },
  { match: "Dodges", keywordId: "dodge" },
  { match: "Dodged", keywordId: "dodge" },
  { match: "Dodging", keywordId: "dodge" },
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
  { match: "Consumed", keywordId: "consume" },
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
  { match: "Thorns", keywordId: "thorns" },
  { match: "Thorn", keywordId: "thorns" },
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

const MAX_KEYWORD_CACHE_ENTRIES = 256;
const MAX_CACHED_KEYWORD_TEXT_LENGTH = 1024;
const keywordIdsCache = new Map<string, readonly KeywordId[]>();

export function extractKeywordIds(text: string): KeywordId[] {
  // Descriptions recur across cards, traits and equipment. Bound numeric
  // variants and long input, and keep the mutable result owned by the caller.
  if (text.length > MAX_CACHED_KEYWORD_TEXT_LENGTH) return parseKeywordIds(text);
  let keywords = keywordIdsCache.get(text);
  if (keywords) {
    keywordIdsCache.delete(text);
  } else {
    keywords = parseKeywordIds(text);
    if (keywordIdsCache.size >= MAX_KEYWORD_CACHE_ENTRIES) {
      const oldest = keywordIdsCache.keys().next().value;
      if (oldest !== undefined) keywordIdsCache.delete(oldest);
    }
  }
  keywordIdsCache.set(text, keywords);
  return [...keywords];
}

function parseKeywordIds(text: string): KeywordId[] {
  const keywords = new Set<KeywordId>();
  for (const match of text.matchAll(keywordPattern)) {
    const keywordId = keywordAliasMap.get(match[0].toLowerCase());
    if (keywordId) keywords.add(keywordId);
  }
  return Array.from(keywords);
}
