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
  if (cardHealBonus) base.cardHealBonus = addCardHealBonuses(base.cardHealBonus, cardHealBonus);
  if (companionBondLevels) {
    const bonds = { ...base.companionBondLevels };
    for (const id of Object.keys(companionBondLevels) as CompanionId[]) {
      bonds[id] = (bonds[id] ?? 0) + companionBondLevels[id];
    }
    base.companionBondLevels = bonds;
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

function addCardHealBonuses(base: Record<string, number>, addition: Record<string, number>): Record<string, number> {
  const merged = { ...base };
  for (const [id, amount] of Object.entries(addition)) {
    merged[id] = (merged[id] ?? 0) + amount;
  }
  return merged;
}

function mergeCompanionBonds(target: TalentEffectManifest, source: HomesteadEffectManifest): void {
  const merged = { ...target.companionBondLevels };
  for (const id of Object.keys(source.companionBondLevels) as CompanionId[]) {
    merged[id] = Math.max(merged[id] ?? 0, source.companionBondLevels[id]);
  }
  target.companionBondLevels = merged;
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
    if (id in effects.companionBondLevels) {
      effects.companionBondLevels[id as keyof typeof effects.companionBondLevels] = level;
    }
  }

  return effects;
}

export function mergeIntoManifest(
  talentEffects: TalentEffectManifest,
  homesteadEffects: HomesteadEffectManifest,
): TalentEffectManifest {
  const merged: TalentEffectManifest = { ...talentEffects };

  for (const key of HOMESTEAD_BATTLE_NUMERIC_KEYS) {
    merged[key] = addNumericEffect(merged[key], homesteadEffects[key]);
  }

  if (Object.keys(homesteadEffects.cardHealBonus).length > 0) {
    merged.cardHealBonus = addCardHealBonuses(merged.cardHealBonus, homesteadEffects.cardHealBonus);
  }
  mergeCompanionBonds(merged, homesteadEffects);

  return merged;
}
