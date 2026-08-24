// Shared Boon/permanent Trinket manifest defaults and ID-to-effect conversion.
// Effect values are authored on the compendium rows; this module derives the
// flat battle-facing manifest. Used during battle creation and shop pricing.
import { trinketLibrary } from "@/lib/game-data";
import type { TrinketManifest } from "./battle/types";

export const defaultTrinketEffects: TrinketManifest = {
  extraDrawPerBattle: 0,
  firstHolyDamageDoubled: false,
  firstBurnDoubled: false,
  boneCharmHealOnKill: 0,
  forgeStunThreshold: 0,
  forgeStunAmount: 0,
  frozenHeartDamage: 0,
  blockToArmorThreshold: 0,
  blockToArmorAmount: 0,
  runicQuillDrawOnConsume: 0,
  sinEaterHealOnHarmfulStatusRemove: 0,
  vanguardCrestForgeOnBlockAbsorb: 0,
  parasiticBloomLeechChance: 0,
  cutpurseGoldOnBleed: 0,
  wishingWellGoldOnWish: 0,
  plagueDoctorImmunity: false,
  mortarPestleFreeFirstPotion: false,
  sunderingArmorPiercing: 0,
  resonantChimeCardsRequired: 0,
  resonantChimeMana: 0,
  smugglersMapGoldBonus: 0,
  grovesFavorStartHeal: 0,
  merchantsFavorDiscount: 0,
  companionDamageBonus: 0,
  freezeDurationExtension: 0,
  thunderstoneDamageOnStun: 0,
  luckyCloverGoldChance: 0,
};

/** Authored effect per trinket id, derived from the compendium rows. */
const trinketEffects: Record<string, Partial<TrinketManifest>> = Object.fromEntries(
  trinketLibrary.map((entry) => [entry.id, entry.effects]),
);

export function computeTrinketManifest(trinketIds: string[]): TrinketManifest {
  const manifest = { ...defaultTrinketEffects };

  for (const id of trinketIds) {
    const effects = trinketEffects[id];
    if (effects) Object.assign(manifest, effects);
  }

  return manifest;
}

export function combineTrinketEffectIds(runBoons: readonly string[], equippedTrinketId: string | null): string[] {
  return [...new Set(equippedTrinketId ? [...runBoons, equippedTrinketId] : runBoons)];
}

export function isDefaultTrinketManifest(manifest: TrinketManifest): boolean {
  return (Object.keys(defaultTrinketEffects) as Array<keyof TrinketManifest>).every(
    (key) => manifest[key] === defaultTrinketEffects[key],
  );
}
