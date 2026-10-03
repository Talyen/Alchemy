import type { CompanionId, TalentEffectManifest } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "./types";
import { HOMESTEAD_BATTLE_NUMERIC_KEYS } from "./types";
import { defaultHomesteadEffects } from "./defaults";
import { buildings, farmPlots, researchUpgrades } from "./data";

function addNumericEffect(current: number, added: number): number {
  const sum = current + added;
  return Number.isInteger(sum) ? sum : Math.round(sum * 10000) / 10000;
}

function applyTierEffects(base: HomesteadEffectManifest, partial?: Partial<HomesteadEffectManifest>): void {
  if (!partial) return;
  const { cardHealBonus, companionBondLevels, ...numericEffects } = partial;
  for (const key of Object.keys(numericEffects) as Array<keyof typeof numericEffects>) {
    const amount = numericEffects[key];
    if (typeof amount === "number") base[key] = addNumericEffect(base[key], amount);
  }
  for (const [id, amount] of Object.entries(cardHealBonus ?? {})) {
    base.cardHealBonus[id] = (base.cardHealBonus[id] ?? 0) + amount;
  }
  if (companionBondLevels) {
    const bonds = base.companionBondLevels;
    for (const id of Object.keys(companionBondLevels) as CompanionId[]) {
      bonds[id] = (bonds[id] ?? 0) + companionBondLevels[id];
    }
  }
}

function applyItemTiers(
  base: HomesteadEffectManifest,
  items: ReadonlyArray<{ id: string; tiers: ReadonlyArray<{ effects?: Partial<HomesteadEffectManifest> }> }>,
  levels: Record<string, number>,
): void {
  for (const item of items) {
    const level = levels[item.id] ?? 0;
    const cappedLevel = Math.min(level, item.tiers.length);
    for (let i = 0; i < cappedLevel; i++) {
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
  const effects: HomesteadEffectManifest = {
    ...defaultHomesteadEffects,
    companionBondLevels: { ...defaultHomesteadEffects.companionBondLevels },
    cardHealBonus: { ...defaultHomesteadEffects.cardHealBonus },
  };

  applyItemTiers(effects, buildings, constructedBuildings);
  applyItemTiers(effects, farmPlots, plantedFarms);
  applyItemTiers(effects, researchUpgrades, completedResearch);

  for (const [id, level] of Object.entries(bondedCompanions)) {
    if (Object.hasOwn(effects.companionBondLevels, id)) {
      effects.companionBondLevels[id as keyof typeof effects.companionBondLevels] = level;
    }
  }

  return effects;
}

export function mergeIntoManifest(
  talentEffects: TalentEffectManifest,
  homesteadEffects: HomesteadEffectManifest,
): TalentEffectManifest {
  const merged: TalentEffectManifest = {
    ...talentEffects,
    cardHealBonus: { ...talentEffects.cardHealBonus },
    companionBondLevels: { ...talentEffects.companionBondLevels },
  };

  for (const key of HOMESTEAD_BATTLE_NUMERIC_KEYS) {
    merged[key] = addNumericEffect(merged[key], homesteadEffects[key]);
  }

  for (const [id, amount] of Object.entries(homesteadEffects.cardHealBonus)) {
    merged.cardHealBonus[id] = (merged.cardHealBonus[id] ?? 0) + amount;
  }
  for (const id of Object.keys(homesteadEffects.companionBondLevels) as CompanionId[]) {
    merged.companionBondLevels[id] = Math.max(
      merged.companionBondLevels[id] ?? 0,
      homesteadEffects.companionBondLevels[id],
    );
  }

  return merged;
}
