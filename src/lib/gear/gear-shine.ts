import { UI_GOLD } from "@/lib/game-constants/ui-colors";
import { NEUTRAL_SHINE_FALLBACK } from "@/lib/animation/shine-gradient";
import type { KeywordId } from "@/lib/game-data";
import { extractKeywordIds } from "@/lib/keyword-text";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";
import { getKeywordTextShineColors, MAX_TEXT_SHINE_KEYWORDS } from "@/lib/keyword-text-shine";
import { getGearInstanceAffixes } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { gearDefinitions, type GearDefinition } from "./definitions";
import type { GearInstance } from "./types";

const UNIQUE_SHINE_COLORS = [UI_GOLD.light, UI_GOLD.base, UI_GOLD.deep, UI_GOLD.pale, UI_GOLD.light] as const;
const UNIQUE_TEXT_SHINE_COLORS = [UI_GOLD.pale, `color-mix(in srgb, ${UI_GOLD.pale} 55%, transparent)`] as const;

export function selectTextShineKeywordIds(
  instanceKeywordIds: readonly KeywordId[],
  affinityKeywords: readonly KeywordId[],
): KeywordId[] {
  const affinity = new Set(affinityKeywords);
  return [
    ...instanceKeywordIds.filter((id) => affinity.has(id)),
    ...instanceKeywordIds.filter((id) => !affinity.has(id)),
  ].slice(0, MAX_TEXT_SHINE_KEYWORDS);
}

export function getGearInstanceKeywordIds(instance: GearInstance): KeywordId[] {
  const keywordIds = new Set<KeywordId>();

  for (const roll of getGearInstanceAffixes(instance)) {
    const affix = gearAffixCatalog[roll.id];
    if (affix) {
      for (const keywordId of affix.visibleKeywordIds) keywordIds.add(keywordId);
    }
  }

  return [...keywordIds].sort();
}

export function getUniqueGearShineColors(): readonly string[] {
  return UNIQUE_SHINE_COLORS;
}

export function getUniqueGearTextShineColors(): readonly string[] {
  return UNIQUE_TEXT_SHINE_COLORS;
}

function borderShineColors(keywordIds: readonly KeywordId[]): readonly string[] {
  const colors = getKeywordBorderShineColors(keywordIds);
  return colors.length ? colors : [...NEUTRAL_SHINE_FALLBACK];
}

function textShineColors(keywordIds: readonly KeywordId[]): readonly string[] {
  const colors = getKeywordTextShineColors(keywordIds);
  return colors.length ? colors : NEUTRAL_SHINE_FALLBACK.slice(0, 2);
}

export function getGearDefinitionShineColors(definition: GearDefinition): readonly string[] {
  if (definition.rarity !== "unique" && definition.rarity !== "astral") return [];
  const keywords =
    definition.rarity === "unique"
      ? extractKeywordIds(definition.descriptionLines.join(" "))
      : definition.affinityKeywords;
  return borderShineColors(keywords);
}

export function getGearInstanceShineColors(instance: GearInstance): readonly string[] {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition || (definition.rarity !== "unique" && definition.rarity !== "astral")) return [];
  return borderShineColors(getGearInstanceKeywordIds(instance));
}

export function getGearDefinitionTextShineColors(definition: GearDefinition): readonly string[] {
  if (definition.rarity === "unique") return [...UNIQUE_TEXT_SHINE_COLORS];
  return definition.rarity === "astral" ? textShineColors(definition.affinityKeywords) : [];
}

export function getGearInstanceTextShineColors(instance: GearInstance): readonly string[] {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition || (definition.rarity !== "unique" && definition.rarity !== "astral")) return [];
  if (definition.rarity === "unique") return [...UNIQUE_TEXT_SHINE_COLORS];
  return textShineColors(selectTextShineKeywordIds(getGearInstanceKeywordIds(instance), definition.affinityKeywords));
}

export const GEAR_ASTRAL_SHINE_BORDER_WIDTH = 2;

export function getAstralShineColors(instance: GearInstance): readonly string[] | undefined {
  const colors = getGearInstanceShineColors(instance);
  return colors.length > 0 ? colors : undefined;
}

function affixShineKeywordIds(affix: {
  descriptionTemplate: string;
  visibleKeywordIds?: readonly KeywordId[];
}): readonly KeywordId[] {
  return affix.visibleKeywordIds ?? extractKeywordIds(affix.descriptionTemplate);
}

export function getGearAffixTextShineColors(affix: { descriptionTemplate: string }): readonly string[] {
  return textShineColors(affixShineKeywordIds(affix));
}
