import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { gearAffixCatalog } from "./affix-catalog";
import { gearDefinitions } from "./definitions";
import type { GearInstance } from "./types";

const ASTRAL_SHINE_FALLBACK = ["#cbd5e1", "#64748b", "#cbd5e1"] as const;

export function getGearInstanceKeywordIds(instance: GearInstance): KeywordId[] {
  const keywordIds = new Set<KeywordId>();

  for (const roll of instance.affixes) {
    const affix = gearAffixCatalog[roll.id];
    keywordIds.add(affix.keywordId);
    if (affix.secondaryKeywordId) keywordIds.add(affix.secondaryKeywordId);
  }

  return [...keywordIds].sort();
}

export function getGearInstanceShineColors(instance: GearInstance): readonly string[] {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess makes Record lookups possibly undefined
  if (gearDefinitions[instance.definitionId]?.rarity !== "astral") return [];

  const colors: string[] = [];
  for (const keywordId of getGearInstanceKeywordIds(instance)) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess
    colors.push(...keywordDefinitions[keywordId]!.shineColors);
  }

  return colors.length > 0 ? colors : [...ASTRAL_SHINE_FALLBACK];
}

export function getGearInstanceShineGradient(instance: GearInstance): string | null {
  const colors = getGearInstanceShineColors(instance);
  if (colors.length === 0) return null;
  return `linear-gradient(60deg, ${colors.join(",")})`;
}

function getGearAffixShineColors(affix: { keywordId: KeywordId; secondaryKeywordId?: KeywordId }): readonly string[] {
  const colors: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess
  colors.push(...keywordDefinitions[affix.keywordId]!.shineColors);
  if (affix.secondaryKeywordId) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess
    colors.push(...keywordDefinitions[affix.secondaryKeywordId]!.shineColors);
  }
  return colors.length > 0 ? colors : [...ASTRAL_SHINE_FALLBACK];
}

export function getGearAffixShineGradient(affix: {
  keywordId: KeywordId;
  secondaryKeywordId?: KeywordId;
}): string | null {
  const colors = getGearAffixShineColors(affix);
  if (colors.length === 0) return null;
  return `linear-gradient(60deg, ${colors.join(",")})`;
}
