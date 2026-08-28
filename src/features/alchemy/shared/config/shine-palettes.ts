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
import { buildSmoothShineGradient } from "@/lib/animation/shine-gradient";

export { buildSmoothShineBorderGradient, buildSmoothShineGradient } from "@/lib/animation/shine-gradient";

export const SHINE_PALETTES = {
  talentDefault: ["#fcd34d", "#d97706", "#fcd34d"],
  wildcard: ["#fbbf24", "#000000", "#fcd34d", "#111827"],
  bossVictoryFallback: ["#cbd5e1", "#64748b", "#cbd5e1"],
  deathsDoorArt: ["#450a0a", "#dc2626", "#7f1d1d", "#111827"],
  deathsDoorStats: ["#450a0a", "#ef4444", "#991b1b", "#1f0505"],
  turnEnemy: ["#450a0a", "#b91c1c", "#f87171", "#7f1d1d"],
  wildwoodBossSelection: ["#450a0a", "#ef4444", "#991b1b", "#7f1d1d"],
  corruption: ["#450a0a", "#dc2626", "#f87171", "#7f1d1d"],
  boon: ["#312e81", "#818cf8", "#e0e7ff", "#7c3aed"],
  labyrinth: {
    entrance: ["#292524", "#57534e", "#a8a29e", "#44403c"],
    combat: ["#450a0a", "#dc2626", "#f87171", "#7f1d1d"],
    elite: ["#3b0764", "#9333ea", "#c084fc", "#581c87"],
    rest: ["#431407", "#d97706", "#fb923c", "#78350f"],
    mystery: ["#27272a", "#a1a1aa", "#e4e4e7", "#525252"],
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

export function getKeywordListShineColors(keywordIds: readonly KeywordId[]): readonly string[] {
  const seen = new Set<string>();
  const colors: string[] = [];

  for (const keywordId of keywordIds) {
    for (const color of getKeywordShineColors(keywordId)) {
      if (seen.has(color)) continue;
      seen.add(color);
      colors.push(color);
    }
  }

  return colors;
}

export function getCardKeywordShineColors(card: BattleCard): readonly string[] {
  return getKeywordListShineColors(getCardKeywords(card));
}

export function getCompanionShineColors(companion: CompanionDefinition): readonly string[] {
  const colors = getKeywordListShineColors(getCompanionKeywords(companion));
  return colors.length > 0 ? colors : keywordDefinitions.companion.shineColors;
}

export function getTrinketShineColors(trinketId: string): readonly string[] {
  const colors = getKeywordListShineColors(getTrinketKeywords(trinketId));
  return colors.length > 0 ? colors : [...SHINE_PALETTES.boon];
}

export function getTrinketShineGradient(trinketId: string): string | null {
  return buildSmoothShineGradient(getTrinketShineColors(trinketId));
}

export const WILDCARD_KEYWORD_SHINE_COLORS: readonly string[] = Object.values(keywordDefinitions).flatMap((def) => {
  const first = def.shineColors[0];
  return first ? [first] : [];
});

export const WILDCARD_SHINE_CYCLE_MS = 2800;

export function getShineColorsForKeywords(keywordIds: readonly KeywordId[]): readonly string[] {
  if (keywordIds.length === 0) return SHINE_PALETTES.wildcard;

  return keywordIds.map((keywordId) => getKeywordShineColors(keywordId)[0] ?? SHINE_PALETTES.talentDefault[0]);
}

export function getCharacterShineColors(characterId: CharacterId): readonly string[] {
  return getShineColorsForKeywords(characters[characterId].keywords);
}
