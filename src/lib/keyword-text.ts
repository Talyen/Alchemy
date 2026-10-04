import type { KeywordId } from "@/lib/game-data";

const KEYWORD_WORDS: Record<KeywordId, readonly string[]> = {
  dodge: ["Dodge", "Dodges", "Dodged", "Dodging"],
  physical: ["Physical"],
  stun: ["Stun", "Stunned"],
  block: ["Block"],
  forge: ["Forge"],
  armor: ["Armor"],
  health: ["Health"],
  gold: ["Gold"],
  holy: ["Holy"],
  wish: ["Wish"],
  consume: ["Consume", "Consumed"],
  poison: ["Poison", "Poisoned"],
  bleed: ["Bleed", "Bleeds", "Bleeding"],
  leech: ["Leech", "Leeches", "Leeching"],
  freeze: ["Freeze", "Freezes", "Frozen"],
  burn: ["Burn", "Burns", "Burning"],
  companion: ["Companion", "Companions"],
  mana: ["Mana Crystal", "Mana"],
  nature: ["Nature"],
  archery: ["Archery"],
  thorns: ["Thorns", "Thorn"],
};

export const keywordAliases: Array<{ match: string; keywordId: KeywordId }> = Object.entries(KEYWORD_WORDS).flatMap(
  ([keywordId, words]) => words.map((match) => ({ match, keywordId: keywordId as KeywordId })),
);

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
