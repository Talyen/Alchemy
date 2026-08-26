import { buildSmoothShineBorderGradient } from "@/lib/animation/shine-gradient";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { gearAffixCatalog } from "./affix-catalog";
import { gearDefinitions, type GearDefinition } from "./definitions";
import type { GearInstance } from "./types";

const ASTRAL_SHINE_FALLBACK = ["#cbd5e1", "#64748b", "#cbd5e1"] as const;
const UNIQUE_SHINE_COLORS = ["#fbbf24", "#f59e0b", "#d97706", "#fef3c7", "#fbbf24"] as const;

export function getGearInstanceKeywordIds(instance: GearInstance): KeywordId[] {
  const keywordIds = new Set<KeywordId>();

  for (const roll of instance.affixes) {
    const affix = gearAffixCatalog[roll.id];
    if (affix) {
      keywordIds.add(affix.keywordId);
      if (affix.secondaryKeywordId) keywordIds.add(affix.secondaryKeywordId);
    }
  }

  return [...keywordIds].sort();
}

function getAstralKeywordShineColors(keywordIds: readonly KeywordId[]): readonly string[] {
  const colors: string[] = [];
  for (const keywordId of keywordIds) {
    colors.push(...keywordDefinitions[keywordId].shineColors);
  }
  return colors.length > 0 ? colors : [...ASTRAL_SHINE_FALLBACK];
}

export function getGearDefinitionShineColors(definition: GearDefinition): readonly string[] {
  if (definition.rarity === "unique") return [...UNIQUE_SHINE_COLORS];
  if (definition.rarity !== "astral") return [];
  return getAstralKeywordShineColors(definition.affinityKeywords);
}

export function getGearInstanceShineColors(instance: GearInstance): readonly string[] {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return [];
  if (definition.rarity === "unique") return [...UNIQUE_SHINE_COLORS];
  if (definition.rarity !== "astral") return [];
  return getAstralKeywordShineColors(getGearInstanceKeywordIds(instance));
}

/** Shine overlay thickness for astral gear tiles. Hover/select grows to 3px via `.has-shine-border`. */
export const GEAR_ASTRAL_SHINE_BORDER_WIDTH = 2;

export function getAstralShineColors(instance: GearInstance): readonly string[] | undefined {
  const colors = getGearInstanceShineColors(instance);
  return colors.length > 0 ? colors : undefined;
}

export function getGearInstanceShineGradient(instance: GearInstance): string | null {
  const colors = getGearInstanceShineColors(instance);
  return buildSmoothShineBorderGradient(colors);
}

export function getGearDefinitionShineGradient(definition: GearDefinition): string | null {
  return buildSmoothShineBorderGradient(getGearDefinitionShineColors(definition));
}

function getGearAffixShineColors(affix: { keywordId: KeywordId; secondaryKeywordId?: KeywordId }): readonly string[] {
  const colors: string[] = [];

  colors.push(...keywordDefinitions[affix.keywordId].shineColors);
  if (affix.secondaryKeywordId) {
    colors.push(...keywordDefinitions[affix.secondaryKeywordId].shineColors);
  }
  return colors.length > 0 ? colors : [...ASTRAL_SHINE_FALLBACK];
}

export function getGearAffixShineGradient(affix: {
  keywordId: KeywordId;
  secondaryKeywordId?: KeywordId;
}): string | null {
  const colors = getGearAffixShineColors(affix);
  return buildSmoothShineBorderGradient(colors);
}
