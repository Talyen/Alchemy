import { keywordAliasMap, keywordAliases, keywordPattern } from "../config/keywords";
import type { DescriptionPart } from "../types";

export { extractKeywordIds } from "../config/keywords";

const keywordAliasTextMap = new Map<string, string>(
  keywordAliases.map((alias) => [alias.match.toLowerCase(), alias.match]),
);

const MAX_DESCRIPTION_CACHE_ENTRIES = 256;
const MAX_CACHED_DESCRIPTION_LENGTH = 1024;
const descriptionPartsCache = new Map<string, DescriptionPart[]>();

export function tokenizeDescription(line: string): DescriptionPart[] {
  // Numeric descriptions vary during battle. Bound both entry count and line
  // length, and return owned copies to preserve the mutable caller contract.
  if (line.length > MAX_CACHED_DESCRIPTION_LENGTH) return parseDescription(line);
  let pieces = descriptionPartsCache.get(line);
  if (pieces) {
    descriptionPartsCache.delete(line);
  } else {
    pieces = parseDescription(line);
    if (descriptionPartsCache.size >= MAX_DESCRIPTION_CACHE_ENTRIES) {
      const oldest = descriptionPartsCache.keys().next().value;
      if (oldest !== undefined) descriptionPartsCache.delete(oldest);
    }
  }
  descriptionPartsCache.set(line, pieces);
  return pieces.map((part) => ({ ...part }));
}

function parseDescription(line: string): DescriptionPart[] {
  if (line.length === 0) return [{ text: "" }];
  const pieces: DescriptionPart[] = [];
  let lastIndex = 0;
  const matches = line.matchAll(keywordPattern);
  for (const match of matches) {
    const matchedText = match[0];
    const matchIndex = match.index ?? 0;
    const keywordId = keywordAliasMap.get(matchedText.toLowerCase());
    if (matchIndex > lastIndex) pieces.push({ text: line.slice(lastIndex, matchIndex) });
    const displayText = keywordAliasTextMap.get(matchedText.toLowerCase()) ?? matchedText;
    pieces.push(keywordId ? { text: displayText, keywordId } : { text: displayText });
    lastIndex = matchIndex + matchedText.length;
  }
  if (lastIndex < line.length) pieces.push({ text: line.slice(lastIndex) });
  return pieces;
}

export function canonicalizeKeywordText(text: string): string {
  return tokenizeDescription(text)
    .map((part) => part.text)
    .join("");
}

export function getHoverId(scope: string, cardId: string) {
  return `${scope}-${cardId}`;
}
