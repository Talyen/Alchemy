// Description tokenization for keyword-highlighted rules text.
// Depends on keyword alias metadata and description part types.
// Used by card/detail UI so keyword matching stays consistent across descriptions.
import { keywordAliasMap, keywordPattern } from "../config";
import type { DescriptionPart } from "../types";

export function tokenizeDescription(line: string) {
  // Match aliases with the pre-sorted regex from config so multi-word keywords win before
  // shorter substrings, preserving readable highlights in card rules text.
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
