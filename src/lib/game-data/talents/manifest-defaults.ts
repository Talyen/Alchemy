import { defaultCompanionBondLevels } from "../companions";
import { talentRows } from "./talent-rows";
import { isAdditiveBonus, type TalentBonus, type HealthThresholdBonus } from "./talent-builder";

type AuthoredBonuses = (typeof talentRows)[number]["effects"];
type KeysOfUnion<T> = T extends unknown ? keyof T : never;
type BonusAt<T, K> = T extends unknown ? (K extends keyof T ? T[K] : never) : never;
type ManifestValue<T> = T extends null
  ? null
  : T extends number | { kind: "add" }
    ? number
    : T extends boolean
      ? boolean
      : T extends HealthThresholdBonus[]
        ? HealthThresholdBonus[]
        : T extends HealthThresholdBonus
          ? HealthThresholdBonus | null
          : Record<string, number>;
type TalentBonusKey = KeysOfUnion<AuthoredBonuses>;

// Only Homestead-only fields and nonzero defaults need explicit
// registration. Ordinary Talent fields derive their neutral value from the row.
const additionalDefaults = {
  flatPhysicalDamage: 0,
  flatHolyDamage: 0,
  physicalDamageReduction: 0,
  gemFindBonus: 0,
  goldFindBonus: 0,
  homesteadHealing: 0,
  homesteadLeechHealing: 0,
  homesteadPotionBonus: 0,
  homesteadFreeManaChance: 0,
  homesteadForgeBurnPercent: 0,
  startBlock: 0,
  startThorns: 0,
  healMultiplier: 1,
  burnDamageReduction: 0,
  freezeDamageReduction: 0,
  flatBurnDamage: 0,
  potionPotency: 1,
  companionBondLevels: { ...defaultCompanionBondLevels },
  wishExtraChoiceChance: 0,
  runMaxHealthBonus: 0,
  poisonDamageReduction: 0,
  flatFreezeDamage: 0,
  flatArrowDamage: 0,
  flatNatureDamage: 0,
  bleedDesperateMultiplier: 1,
};

export type TalentEffectManifest = {
  [K in TalentBonusKey]: ManifestValue<BonusAt<AuthoredBonuses, K>>;
} & Omit<typeof additionalDefaults, TalentBonusKey>;

function neutralBonus(value: TalentBonus): unknown {
  if (value === null) return null;
  if (typeof value === "number" || isAdditiveBonus(value)) return 0;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return [];
  return "threshold" in value && "amount" in value ? null : {};
}

export const DEFAULT_TALENT_EFFECTS = {
  ...Object.fromEntries(
    talentRows.flatMap((talent) =>
      Object.entries<TalentBonus>(talent.effects).map(([field, value]) => [field, neutralBonus(value)]),
    ),
  ),
  ...additionalDefaults,
} as TalentEffectManifest;

export function createEmptyTalentEffectManifest(): TalentEffectManifest {
  return structuredClone(DEFAULT_TALENT_EFFECTS);
}
