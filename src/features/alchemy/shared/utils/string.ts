import { keywordAliasMap, keywordPattern } from "../config/keywords";
import type { DescriptionPart } from "../types";

export { extractKeywordIds } from "../config/keywords";

export function tokenizeDescription(line: string) {
  const pieces: DescriptionPart[] = [];
  let lastIndex = 0;
  const matches = line.matchAll(keywordPattern);
  for (const match of matches) {
    const matchedText = match[0];
    const matchIndex = match.index ?? 0;
    const keywordId = keywordAliasMap.get(matchedText.toLowerCase());
    if (matchIndex > lastIndex) pieces.push({ text: line.slice(lastIndex, matchIndex) });
    if (keywordId) pieces.push({ text: matchedText, keywordId });
    else pieces.push({ text: matchedText });
    lastIndex = matchIndex + matchedText.length;
  }
  if (lastIndex < line.length) pieces.push({ text: line.slice(lastIndex) });
  return pieces.length > 0 ? pieces : [{ text: line }];
}

export function getHoverId(scope: string, cardId: string) {
  return `${scope}-${cardId}`;
}
