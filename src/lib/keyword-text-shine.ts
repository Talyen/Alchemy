import { keywordDefinitions, type KeywordId } from "@/lib/game-data";

export const MAX_TEXT_SHINE_KEYWORDS = 3;

export function getKeywordTextShineColors(keywordIds: readonly KeywordId[]): string[] {
  return [...new Set(keywordIds)].slice(0, MAX_TEXT_SHINE_KEYWORDS).flatMap((keywordId) => {
    const [primary] = keywordDefinitions[keywordId].shineColors;
    return primary ? [primary, `color-mix(in srgb, ${primary} 55%, transparent)`] : [];
  });
}
