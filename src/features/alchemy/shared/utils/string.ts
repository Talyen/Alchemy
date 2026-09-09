import { keywordAliasMap, keywordAliases, keywordPattern } from "../config/keywords";
import type { DescriptionPart } from "../types";

export { extractKeywordIds } from "../config/keywords";

const keywordAliasTextMap = new Map<string, string>(
  keywordAliases.map((alias) => [alias.match.toLowerCase(), alias.match]),
);

export function tokenizeDescription(line: string): DescriptionPart[] {
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
