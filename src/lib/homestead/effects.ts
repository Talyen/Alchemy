// Computes the HomesteadEffectManifest from constructed buildings, farm plots,
// completed research, and bonded companions. Also provides a merge helper that
// folds homestead effects into a TalentEffectManifest for battle use.

import type { TalentEffectManifest } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "./types";
import { defaultHomesteadEffects } from "./defaults";
import { buildings, farmPlots, researchUpgrades } from "./data";

function applyTierEffects(base: HomesteadEffectManifest, partial?: Partial<HomesteadEffectManifest>): void {
  if (!partial) return;
  const b = base as unknown as Record<string, number | boolean>;
  for (const key of Object.keys(partial) as (keyof HomesteadEffectManifest)[]) {
    const val = partial[key];
    if (typeof val === "number") {
      b[key] = ((b[key] as number) ?? 0) + val;
    } else if (typeof val === "boolean") {
      b[key] = (b[key] as boolean) || val;
    }
  }
}

function applyItemTiers<I extends { id: string; tiers: { effects?: Partial<HomesteadEffectManifest> }[] }>(
  base: HomesteadEffectManifest,
  items: I[],
  levels: Record<string, number>,
): void {
  for (const [id, level] of Object.entries(levels)) {
    const item = items.find((i) => i.id === id);
    if (!item) continue;
    for (let i = 0; i < level; i++) {
      applyTierEffects(base, item.tiers[i]?.effects);
    }
  }
}

export function computeHomesteadEffects(
  constructedBuildings: Record<string, number>,
  plantedFarms: Record<string, number>,
  completedResearch: Record<string, number>,
  bondedCompanions: Record<string, number> = {},
): HomesteadEffectManifest {
  const effects = { ...defaultHomesteadEffects };

  applyItemTiers(effects, buildings, constructedBuildings);
  applyItemTiers(effects, farmPlots, plantedFarms);
  applyItemTiers(effects, researchUpgrades, completedResearch);

  effects.companionBondLevels = { ...effects.companionBondLevels };
  for (const [id, level] of Object.entries(bondedCompanions)) {
    if (id in effects.companionBondLevels) {
      effects.companionBondLevels[id as keyof typeof effects.companionBondLevels] = level;
    }
  }

  return effects;
}

// Merges homestead effects into a TalentEffectManifest so battle code reads
// combined bonuses from a single source.
export function mergeIntoManifest(
  talentEffects: TalentEffectManifest,
  homesteadEffects: HomesteadEffectManifest,
): TalentEffectManifest {
  return {
    ...talentEffects,
    flatPhysicalDamage: talentEffects.flatPhysicalDamage + homesteadEffects.flatPhysicalDamage,
    companionDamage: talentEffects.companionDamage + homesteadEffects.companionDamage,
    startGold: talentEffects.startGold + homesteadEffects.startGold,
    startBlock: talentEffects.startBlock + homesteadEffects.startBlock,
    campfireHealBonus: talentEffects.campfireHealBonus + homesteadEffects.campfireHealBonus,
    physicalCritChance: talentEffects.physicalCritChance + homesteadEffects.physicalCritChance,
    companionBondLevels: { ...talentEffects.companionBondLevels, ...homesteadEffects.companionBondLevels },
    potionDiscount: talentEffects.potionDiscount + Math.round(homesteadEffects.potionDiscount * 100) / 100,
    potionPotency: talentEffects.potionPotency + homesteadEffects.potionPotency,
    forgeToBurn: talentEffects.forgeToBurn || homesteadEffects.forgeToBurn,
    flatBurnDamage: talentEffects.flatBurnDamage + homesteadEffects.flatBurnDamage,
    flatArrowDamage: talentEffects.flatArrowDamage + homesteadEffects.flatArrowDamage,
    flatFreezeDamage: talentEffects.flatFreezeDamage + homesteadEffects.flatFreezeDamage,
    flatNatureDamage: talentEffects.flatNatureDamage + homesteadEffects.flatNatureDamage,
    wishCrystalGold: talentEffects.wishCrystalGold + homesteadEffects.wishCrystalGold,
    startMana: talentEffects.startMana + homesteadEffects.startMana,
    consumeHealMultiplier: talentEffects.consumeHealMultiplier + homesteadEffects.consumeHealMultiplier,
    potionMixPotency: talentEffects.potionMixPotency + homesteadEffects.potionMixPotency,
    trinketChanceBonus: talentEffects.trinketChanceBonus + homesteadEffects.trinketChanceBonus,
    burnDamageReduction: talentEffects.burnDamageReduction + homesteadEffects.burnDamageReduction,
    freezeDamageReduction: talentEffects.freezeDamageReduction + homesteadEffects.freezeDamageReduction,
    natureDamageReduction: talentEffects.natureDamageReduction + homesteadEffects.natureDamageReduction,
  };
}
