import type { KeywordId } from "@/lib/game-data";
import { memoizeShortText } from "./memoize-short-text";

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

const cachedKeywordIds = memoizeShortText(parseKeywordIds);

export function extractKeywordIds(text: string): KeywordId[] {
  // Descriptions recur across cards, traits and equipment. Bound numeric
  // variants and long input, and keep the mutable result owned by the caller.
  return [...cachedKeywordIds(text)];
}

function parseKeywordIds(text: string): KeywordId[] {
  const keywords = new Set<KeywordId>();
  for (const match of text.matchAll(keywordPattern)) {
    const keywordId = keywordAliasMap.get(match[0].toLowerCase());
    if (keywordId) keywords.add(keywordId);
  }
  return Array.from(keywords);
}
