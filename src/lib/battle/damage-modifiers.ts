import type { DamageType, TalentEffectManifest } from "@/lib/game-data";
import type { GearEffectManifest } from "@/lib/gear";
import type { BattleSnapshot } from "./types/state-types";

type NumericKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];
type BooleanKey<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T];
interface DamageModifierSources {
  talentBonus?: NumericKey<TalentEffectManifest>;
  gearBonus: NumericKey<GearEffectManifest>;
  gearResistance: NumericKey<GearEffectManifest>;
  talentReduction?: NumericKey<TalentEffectManifest>;
  talentHalfDamage?: BooleanKey<TalentEffectManifest>;
}

/** Source manifests retain their save shape; common damage modifiers share one typed vocabulary. */
const DAMAGE_MODIFIER_SOURCES: Record<DamageType, DamageModifierSources> = {
  physical: { talentBonus: "flatPhysicalDamage", gearBonus: "flatPhysicalDamage", gearResistance: "resistPhysical" },
  stun: { talentBonus: "flatStunDamage", gearBonus: "flatStunDamage", gearResistance: "resistStun" },
  holy: { gearBonus: "flatHolyDamage", gearResistance: "resistHoly", talentHalfDamage: "receiveHalfHolyDamage" },
  bleed: { gearBonus: "flatBleedDamage", gearResistance: "resistBleed", talentHalfDamage: "receiveHalfBleedDamage" },
  burn: {
    talentBonus: "flatBurnDamage",
    gearBonus: "flatBurnDamage",
    gearResistance: "resistBurn",
    talentReduction: "burnDamageReduction",
    talentHalfDamage: "receiveHalfBurnDamage",
  },
  freeze: {
    talentBonus: "flatFreezeDamage",
    gearBonus: "flatFreezeDamage",
    gearResistance: "resistFreeze",
    talentReduction: "freezeDamageReduction",
    talentHalfDamage: "receiveHalfFreezeDamage",
  },
  nature: {
    talentBonus: "flatNatureDamage",
    gearBonus: "flatNatureDamage",
    gearResistance: "resistNature",
    talentReduction: "natureDamageReduction",
    talentHalfDamage: "receiveHalfNatureDamage",
  },
  poison: {
    gearBonus: "flatPoisonDamage",
    gearResistance: "resistPoison",
    talentReduction: "poisonDamageReduction",
    talentHalfDamage: "receiveHalfPoisonDamage",
  },
};

function sources(damageType: string | undefined): DamageModifierSources | undefined {
  return damageType && Object.hasOwn(DAMAGE_MODIFIER_SOURCES, damageType)
    ? DAMAGE_MODIFIER_SOURCES[damageType as DamageType]
    : undefined;
}

export function flatDamageBonus(
  state: Pick<BattleSnapshot, "talentEffects" | "gearEffects">,
  type: DamageType,
): number {
  const source = DAMAGE_MODIFIER_SOURCES[type];
  return state.gearEffects[source.gearBonus] + (source.talentBonus ? state.talentEffects[source.talentBonus] : 0);
}

export function flatDamageReduction(talents: TalentEffectManifest, type: string | undefined): number {
  const key = sources(type)?.talentReduction;
  return key ? talents[key] : 0;
}

export function receivesHalfDamage(talents: TalentEffectManifest, type: string | undefined): boolean {
  const key = sources(type)?.talentHalfDamage;
  return key ? talents[key] : false;
}

export function gearResistancePercent(gear: GearEffectManifest, type: string | undefined): number {
  const key = sources(type)?.gearResistance;
  return key ? gear[key] : 0;
}
