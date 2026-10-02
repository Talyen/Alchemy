import { keywordDefinitions, type KeywordId } from "@/lib/game-data";

export const MAX_TEXT_SHINE_KEYWORDS = 3;

export function getKeywordTextShineColors(keywordIds: readonly KeywordId[]): string[] {
  const seen = new Set<KeywordId>();
  const colors: string[] = [];
  for (const keywordId of keywordIds) {
    if (seen.has(keywordId)) continue;
    seen.add(keywordId);
    const [primary] = keywordDefinitions[keywordId].shineColors;
    if (primary) colors.push(primary, `color-mix(in srgb, ${primary} 55%, transparent)`);
    if (seen.size === MAX_TEXT_SHINE_KEYWORDS) break;
  }
  return colors;
}
