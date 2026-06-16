import type { KeywordId } from "@/lib/game-data";
import type { GearAffixId } from "./affix-ids";
import { GEAR_AFFIX_IDS } from "./affix-ids";
import type { GearEffectManifest } from "./types";
import { defaultGearEffects } from "./types";

export type GearAffixDefinition = {
  id: GearAffixId;
  keywordId: KeywordId;
  descriptionLine: string;
  effectKey: keyof GearEffectManifest;
  value: number;
};

export const gearAffixCatalog: Record<GearAffixId, GearAffixDefinition> = {
  "flat-physical-1": {
    id: "flat-physical-1",
    keywordId: "physical",
    descriptionLine: "Increases Physical damage by 1.",
    effectKey: "flatPhysicalDamage",
    value: 1,
  },
  "flat-stun-1": {
    id: "flat-stun-1",
    keywordId: "stun",
    descriptionLine: "Increases Stun damage by 1.",
    effectKey: "flatStunDamage",
    value: 1,
  },
  "flat-holy-1": {
    id: "flat-holy-1",
    keywordId: "holy",
    descriptionLine: "Increases Holy damage by 1.",
    effectKey: "flatHolyDamage",
    value: 1,
  },
  "flat-burn-1": {
    id: "flat-burn-1",
    keywordId: "burn",
    descriptionLine: "Increases Burn damage by 1.",
    effectKey: "flatBurnDamage",
    value: 1,
  },
  "flat-poison-1": {
    id: "flat-poison-1",
    keywordId: "poison",
    descriptionLine: "Increases Poison damage by 1.",
    effectKey: "flatPoisonDamage",
    value: 1,
  },
  "flat-bleed-1": {
    id: "flat-bleed-1",
    keywordId: "bleed",
    descriptionLine: "Increases Bleed damage by 1.",
    effectKey: "flatBleedDamage",
    value: 1,
  },
  "flat-freeze-1": {
    id: "flat-freeze-1",
    keywordId: "freeze",
    descriptionLine: "Increases Freeze damage by 1.",
    effectKey: "flatFreezeDamage",
    value: 1,
  },
  "flat-nature-1": {
    id: "flat-nature-1",
    keywordId: "nature",
    descriptionLine: "Increases Nature damage by 1.",
    effectKey: "flatNatureDamage",
    value: 1,
  },
};

export const gearAffixList = Object.values(gearAffixCatalog);

const EFFECT_SUMMARY_LABELS: Record<keyof GearEffectManifest, string> = {
  flatPhysicalDamage: "Physical",
  flatStunDamage: "Stun",
  flatHolyDamage: "Holy",
  flatBurnDamage: "Burn",
  flatPoisonDamage: "Poison",
  flatBleedDamage: "Bleed",
  flatFreezeDamage: "Freeze",
  flatNatureDamage: "Nature",
};

export function isGearAffixId(value: string): value is GearAffixId {
  return value in gearAffixCatalog;
}

export function resolveAffixEffects(affixIds: readonly GearAffixId[]): GearEffectManifest {
  const effects = { ...defaultGearEffects };
  for (const affixId of affixIds) {
    const affix = gearAffixCatalog[affixId];
    if (!affix) continue;
    effects[affix.effectKey] += affix.value;
  }
  return effects;
}

export function modifiersToAffixIds(modifiers: { kind: string; value: number }[]): GearAffixId[] {
  const affixIds: GearAffixId[] = [];
  for (const modifier of modifiers) {
    if (modifier.kind !== "flatPhysicalDamage" || !Number.isFinite(modifier.value)) continue;
    const count = Math.max(0, Math.round(modifier.value));
    for (let index = 0; index < count; index += 1) {
      affixIds.push("flat-physical-1");
    }
  }
  return affixIds;
}

export function getGearAffixDescriptionLines(affixIds: readonly GearAffixId[]): { key: string; text: string }[] {
  return affixIds.flatMap((affixId, index) => {
    const line = gearAffixCatalog[affixId]?.descriptionLine;
    return line ? [{ key: `${affixId}-${index}`, text: line }] : [];
  });
}

export function formatGearEffectSummary(effects: GearEffectManifest): string[] {
  return (Object.keys(EFFECT_SUMMARY_LABELS) as (keyof GearEffectManifest)[]).flatMap((key) => {
    const amount = effects[key];
    if (amount <= 0) return [];
    return [`+${amount} ${EFFECT_SUMMARY_LABELS[key]} damage`];
  });
}

export { GEAR_AFFIX_IDS };
