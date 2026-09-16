import { keywordDefinitions, type KeywordId } from "@/lib/game-data";

/**
 * Derives normalized border shine colors from a list of keywords.
 *
 * For 1 keyword, returns the full 3-stop pulse ([light, dark, light]).
 * For multiple keywords, takes each keyword's primary accent color and loops
 * back to the first color ([k1, k2, k1] or [k1, k2, k3, k1]), ensuring
 * a seamless 3-5 stop cycle with uniform visual tempo.
 */
export function getKeywordBorderShineColors(keywordIds: readonly KeywordId[]): readonly string[] {
  const uniqueKeywordIds = [...new Set(keywordIds)];
  if (uniqueKeywordIds.length === 0) return [];

  if (uniqueKeywordIds.length === 1) {
    const [keywordId] = uniqueKeywordIds;
    return [...(keywordDefinitions[keywordId!]?.shineColors ?? [])];
  }

  const primaryColors: string[] = [];
  for (const keywordId of uniqueKeywordIds) {
    const [primary] = keywordDefinitions[keywordId]?.shineColors ?? [];
    if (primary && !primaryColors.includes(primary)) {
      primaryColors.push(primary);
    }
  }

  if (primaryColors.length === 0) return [];
  if (primaryColors.length === 1) {
    const [keywordId] = uniqueKeywordIds;
    return [...(keywordDefinitions[keywordId!]?.shineColors ?? [])];
  }

  return [...primaryColors, primaryColors[0]!];
}
