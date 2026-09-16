import { buildSmoothShineBorderGradient } from "@/lib/animation/shine-gradient";
import type { KeywordId } from "@/lib/game-data";
import { extractKeywordIds } from "@/lib/keyword-text";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";
import { getKeywordTextShineColors, MAX_TEXT_SHINE_KEYWORDS } from "@/lib/keyword-text-shine";
import { getGearInstanceAffixes } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { gearDefinitions, type GearDefinition } from "./definitions";
import type { GearInstance } from "./types";

const ASTRAL_SHINE_FALLBACK = ["#cbd5e1", "#64748b", "#cbd5e1"] as const;
const UNIQUE_SHINE_COLORS = ["#fbbf24", "#f59e0b", "#d97706", "#fef3c7", "#fbbf24"] as const;
const UNIQUE_TEXT_SHINE_COLORS = ["#fbbf24", "color-mix(in srgb, #fbbf24 55%, transparent)"] as const;

export function selectTextShineKeywordIds(
  instanceKeywordIds: readonly KeywordId[],
  affinityKeywords: readonly KeywordId[],
): KeywordId[] {
  const affinity = new Set<KeywordId>(affinityKeywords);
  const preferred: KeywordId[] = [];
  const rest: KeywordId[] = [];
  for (const keywordId of instanceKeywordIds) {
    if (affinity.has(keywordId)) {
      preferred.push(keywordId);
    } else {
      rest.push(keywordId);
    }
  }
  return [...preferred, ...rest].slice(0, MAX_TEXT_SHINE_KEYWORDS);
}

export function getGearInstanceKeywordIds(instance: GearInstance): KeywordId[] {
  const keywordIds = new Set<KeywordId>();

  for (const roll of getGearInstanceAffixes(instance)) {
    const affix = gearAffixCatalog[roll.id];
    if (affix) {
      for (const keywordId of extractKeywordIds(affix.descriptionTemplate)) keywordIds.add(keywordId);
    }
  }

  return [...keywordIds].sort();
}

function collectShineColors(keywordIds: readonly KeywordId[], mode: "border" | "text"): readonly string[] {
  const colors = mode === "text" ? getKeywordTextShineColors(keywordIds) : getKeywordBorderShineColors(keywordIds);
  if (colors.length > 0) return colors;
  return mode === "border" ? [...ASTRAL_SHINE_FALLBACK] : ASTRAL_SHINE_FALLBACK.slice(0, 2);
}

export function getUniqueGearShineColors(): readonly string[] {
  return UNIQUE_SHINE_COLORS;
}

export function getUniqueGearTextShineColors(): readonly string[] {
  return UNIQUE_TEXT_SHINE_COLORS;
}

function resolveShineColors(
  rarity: string | null | undefined,
  mode: "border" | "text",
  keywordIds: readonly KeywordId[],
): readonly string[] {
  if (rarity === "unique") return mode === "text" ? [...UNIQUE_TEXT_SHINE_COLORS] : [...UNIQUE_SHINE_COLORS];
  if (rarity !== "astral") return [];
  return collectShineColors(keywordIds, mode);
}

export function getGearDefinitionShineColors(definition: GearDefinition): readonly string[] {
  return resolveShineColors(definition.rarity, "border", definition.affinityKeywords);
}

export function getGearInstanceShineColors(instance: GearInstance): readonly string[] {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return [];
  return resolveShineColors(definition.rarity, "border", getGearInstanceKeywordIds(instance));
}

export function getGearDefinitionTextShineColors(definition: GearDefinition): readonly string[] {
  return resolveShineColors(definition.rarity, "text", definition.affinityKeywords);
}

export function getGearInstanceTextShineColors(instance: GearInstance): readonly string[] {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return [];
  return resolveShineColors(
    definition.rarity,
    "text",
    selectTextShineKeywordIds(getGearInstanceKeywordIds(instance), definition.affinityKeywords),
  );
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

export function getGearAffixTextShineColors(affix: { descriptionTemplate: string }): readonly string[] {
  return collectShineColors(extractKeywordIds(affix.descriptionTemplate), "text");
}
