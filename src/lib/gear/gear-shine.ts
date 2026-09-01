import { buildSmoothShineBorderGradient } from "@/lib/animation/shine-gradient";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { gearAffixCatalog } from "./affix-catalog";
import { gearDefinitions, type GearDefinition } from "./definitions";
import type { GearInstance } from "./types";

const ASTRAL_SHINE_FALLBACK = ["#cbd5e1", "#64748b", "#cbd5e1"] as const;
const UNIQUE_SHINE_COLORS = ["#fbbf24", "#f59e0b", "#d97706", "#fef3c7", "#fbbf24"] as const;
const UNIQUE_TEXT_SHINE_COLORS = ["#fbbf24", "color-mix(in srgb, #fbbf24 55%, transparent)"] as const;

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

function collectShineColors(keywordIds: readonly KeywordId[], mode: "border" | "text"): readonly string[] {
  const colors: string[] = [];
  for (const keywordId of keywordIds) {
    const shineColors = keywordDefinitions[keywordId].shineColors;
    if (mode === "border") {
      colors.push(...shineColors);
    } else {
      const [primary, secondary = primary] = shineColors;
      if (primary) colors.push(primary);
      if (secondary && secondary !== primary) colors.push(secondary);
    }
  }
  if (colors.length > 0) return colors;
  return mode === "border" ? [...ASTRAL_SHINE_FALLBACK] : ASTRAL_SHINE_FALLBACK.slice(0, 2);
}

function getShineColorsForRarity(
  rarity: string | null | undefined,
  keywordIds: readonly KeywordId[],
  mode: "border" | "text",
): readonly string[] {
  if (rarity === "unique") return mode === "border" ? [...UNIQUE_SHINE_COLORS] : [...UNIQUE_TEXT_SHINE_COLORS];
  if (rarity !== "astral") return [];
  return collectShineColors(keywordIds, mode);
}

export function getUniqueGearTextShineColors(): readonly string[] {
  return UNIQUE_TEXT_SHINE_COLORS;
}

export function getGearDefinitionShineColors(definition: GearDefinition): readonly string[] {
  return getShineColorsForRarity(definition.rarity, definition.affinityKeywords, "border");
}

export function getGearInstanceShineColors(instance: GearInstance): readonly string[] {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return [];
  return getShineColorsForRarity(definition.rarity, getGearInstanceKeywordIds(instance), "border");
}

export function getGearDefinitionTextShineColors(definition: GearDefinition): readonly string[] {
  return getShineColorsForRarity(definition.rarity, definition.affinityKeywords, "text");
}

export function getGearInstanceTextShineColors(instance: GearInstance): readonly string[] {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return [];
  return getShineColorsForRarity(definition.rarity, getGearInstanceKeywordIds(instance), "text");
}

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

export function getGearAffixTextShineColors(affix: {
  keywordId: KeywordId;
  secondaryKeywordId?: KeywordId;
}): readonly string[] {
  return collectShineColors(
    affix.secondaryKeywordId ? [affix.keywordId, affix.secondaryKeywordId] : [affix.keywordId],
    "text",
  );
}
