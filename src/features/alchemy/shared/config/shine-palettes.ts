import { UI_GOLD } from "@/lib/game-constants/ui-colors";
import {
  characters,
  getCardKeywords,
  getCompanionKeywords,
  getTrinketKeywords,
  keywordDefinitions,
  type BattleCard,
  type CharacterId,
  type CompanionDefinition,
  type KeywordId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { NEUTRAL_SHINE_FALLBACK } from "@/lib/animation/shine-gradient";

// NOTE: gradient builders and keyword-shine helpers live in @/lib (single
// import path). Import them from there directly; this module owns palettes
// and palette selectors only and must not re-export lib helpers.

const GOLD_SHINE = [UI_GOLD.light, UI_GOLD.deep, UI_GOLD.light] as const;
const CORRUPTION_SHINE = ["#450a0a", "#dc2626", "#f87171", "#7f1d1d"] as const;

export const SHINE_PALETTES = {
  gold: [...GOLD_SHINE],
  talentDefault: [...GOLD_SHINE],
  wildcard: ["#fbbf24", "#000000", "#fcd34d", "#111827"],
  bossVictoryFallback: [...NEUTRAL_SHINE_FALLBACK],
  deathsDoorArt: ["#450a0a", "#dc2626", "#7f1d1d", "#111827"],
  deathsDoorStats: ["#450a0a", "#ef4444", "#991b1b", "#1f0505"],
  turnEnemy: ["#450a0a", "#b91c1c", "#f87171", "#7f1d1d"],
  wildwoodBossSelection: ["#450a0a", "#ef4444", "#991b1b", "#7f1d1d"],
  corruption: [...CORRUPTION_SHINE],
  boon: ["#312e81", "#818cf8", "#e0e7ff", "#7c3aed"],
  labyrinth: {
    entrance: ["#292524", "#57534e", "#a8a29e", "#44403c"],
    combat: [...CORRUPTION_SHINE],
    elite: ["#3b0764", "#9333ea", "#c084fc", "#581c87"],
    rest: ["#431407", "#d97706", "#fb923c", "#78350f"],
    mystery: ["#27272a", "#a1a1aa", "#e4e4e7", "#525252"],
    corruption: [...CORRUPTION_SHINE],
    shop: ["#422006", "#eab308", "#fde047", "#78350f"],
    alchemist: ["#022c22", "#10b981", "#6ee7b7", "#064e3b"],
    "trinket-shop": ["#2e1065", "#a855f7", "#e9d5ff", "#581c87"],
    "equipment-shop": ["#1e293b", "#94a3b8", "#e2e8f0", "#334155"],
    boss: ["#450a0a", "#b91c1c", "#fca5a5", "#7f1d1d"],
  },
} as const;

export function getKeywordShineColors(keywordId: KeywordId): readonly string[] {
  return keywordDefinitions[keywordId]?.shineColors ?? SHINE_PALETTES.talentDefault;
}

export function getInspectionKeywordShineColors(keywordIds: readonly KeywordId[]): readonly string[] {
  const colors = getKeywordBorderShineColors(keywordIds);
  return colors.length > 0 ? colors : SHINE_PALETTES.bossVictoryFallback;
}

export function getCardKeywordShineColors(card: BattleCard): readonly string[] {
  return getKeywordBorderShineColors(getCardKeywords(card));
}

export function getCompanionShineColors(companion: CompanionDefinition): readonly string[] {
  const colors = getKeywordBorderShineColors(getCompanionKeywords(companion));
  return colors.length > 0 ? colors : keywordDefinitions.companion.shineColors;
}

export function getTrinketShineColors(trinketId: string): readonly string[] {
  const colors = getKeywordBorderShineColors(getTrinketKeywords(trinketId));
  return colors.length > 0 ? colors : [...SHINE_PALETTES.boon];
}

export function getTrinketTextShineColors(trinketId: string): readonly string[] {
  const colors = getKeywordTextShineColors(getTrinketKeywords(trinketId));
  return colors.length > 0 ? colors : [...SHINE_PALETTES.boon];
}

export const WILDCARD_KEYWORD_SHINE_COLORS: readonly string[] = Object.values(keywordDefinitions).flatMap((def) => {
  const first = def.shineColors[0];
  return first ? [first] : [];
});

export function getShineColorsForKeywords(keywordIds: readonly KeywordId[]): readonly string[] {
  if (keywordIds.length === 0) return SHINE_PALETTES.wildcard;

  return keywordIds.map((keywordId) => getKeywordShineColors(keywordId)[0] ?? SHINE_PALETTES.talentDefault[0]);
}

export function getCharacterShineColors(characterId: CharacterId): readonly string[] {
  return getShineColorsForKeywords(characters[characterId].keywords);
}

export function getHeroCardShineColors(characterId: CharacterId): readonly string[] {
  return characterId === "wildcard" ? WILDCARD_KEYWORD_SHINE_COLORS : getCharacterShineColors(characterId);
}
