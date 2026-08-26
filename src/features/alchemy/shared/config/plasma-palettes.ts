// Two-stop keyword colors for ambient plasma backgrounds — mirrors Trinket primary/secondary pairing.
import {
  characters,
  keywordDefinitions,
  type CharacterId,
  type KeywordId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { getKeywordShineColors, WILDCARD_KEYWORD_SHINE_COLORS } from "./shine-palettes";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

export type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
export { lerpPlasmaColor, parsePlasmaHexColor } from "@/lib/animation/plasma-colors";

export function getPlasmaKeywordsForCharacter(id: CharacterId): KeywordId[] {
  return [...characters[id].keywords];
}

/** Primary + secondary plasma stops; null when no colors resolve. */
export function getPlasmaColorPair(keywordIds: readonly KeywordId[]): PlasmaColorPair | null {
  if (keywordIds.length === 0) {
    const primary = WILDCARD_KEYWORD_SHINE_COLORS[0];
    const secondary = WILDCARD_KEYWORD_SHINE_COLORS[1] ?? WILDCARD_KEYWORD_SHINE_COLORS[2];
    if (!primary || !secondary) return null;
    return { primary, secondary };
  }

  const firstPalette = getKeywordShineColors(keywordIds[0]!);
  const primary = firstPalette[0];
  if (!primary) return null;

  const secondary =
    keywordIds.length > 1
      ? (getKeywordShineColors(keywordIds[1]!)[0] ?? firstPalette[1])
      : (firstPalette[1] ?? primary);

  return { primary, secondary: secondary ?? primary };
}

export function getPlasmaColorPairForCharacter(id: CharacterId): PlasmaColorPair | null {
  return getPlasmaColorPair(getPlasmaKeywordsForCharacter(id));
}

/** Stable keyword ordering for plasma (character affinities are already ordered in data). */
export function getPlasmaKeywordLabel(keywordId: KeywordId): string {
  return keywordDefinitions[keywordId]?.label ?? keywordId;
}
