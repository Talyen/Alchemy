// Keyword text matching metadata for card description highlighting.
// Depends on game-data keyword identifiers only.
import type { KeywordId } from "@/lib/game-data";

// Maps display-friendly strings like "Physical" to their KeywordId.
// Used to colorize card descriptions; longer aliases win before sub-strings.
export const keywordAliases: Array<{ match: string; keywordId: KeywordId }> = [
  { match: "Physical", keywordId: "physical" },
  { match: "Stun", keywordId: "stun" },
  { match: "Stunned", keywordId: "stun" },
  { match: "Block", keywordId: "block" },
  { match: "Forge", keywordId: "forge" },
  { match: "Armor", keywordId: "armor" },
  { match: "Health", keywordId: "health" },
  { match: "Burn", keywordId: "burn" },
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
  { match: "Companion", keywordId: "companion" },
  { match: "Archery", keywordId: "archery" },
];

// Pre-compiled regex for keyword highlighting so card description rendering
// does not rebuild this expression on every render.
export const keywordPattern = new RegExp(
  `\\b(${keywordAliases
    .map((alias) => alias.match.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
    .sort((left, right) => right.length - left.length)
    .join("|")})\\b`,
  "gi",
);
