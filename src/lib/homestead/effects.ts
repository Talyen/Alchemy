import type { TalentEffectManifest } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "./types";
import { HOMESTEAD_BATTLE_NUMERIC_KEYS, HOMESTEAD_BATTLE_BOOLEAN_KEYS } from "./types";
import { defaultHomesteadEffects } from "./defaults";
import { buildings, farmPlots, researchUpgrades } from "./data";

function addNumericEffect(current: number, added: number): number {
  const sum = current + added;
  return Number.isInteger(sum) ? sum : Math.round(sum * 10000) / 10000;
}

function applyTierEffects(base: HomesteadEffectManifest, partial?: Partial<HomesteadEffectManifest>): void {
  if (!partial) return;
  for (const key of Object.keys(partial) as Array<keyof HomesteadEffectManifest>) {
    const val = partial[key];
    if (typeof val === "number") {
      (base[key] as number) = addNumericEffect(base[key] as number, val);
    } else if (typeof val === "boolean") {
      (base[key] as boolean) = (base[key] as boolean) || val;
    } else if (typeof val === "object" && val !== null) {
      const baseVal = base[key];
      if (typeof baseVal === "object" && baseVal !== null) {
        const merged = { ...(baseVal as Record<string, number>) };
        for (const [k, v] of Object.entries(val)) {
          merged[k] = (merged[k] ?? 0) + v;
        }
        (base[key] as Record<string, number>) = merged;
      }
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

function mergeCardHealBonus(target: TalentEffectManifest, source: HomesteadEffectManifest): void {
  if (Object.keys(source.cardHealBonus).length === 0) return;
  const merged = { ...target.cardHealBonus };
  for (const [k, v] of Object.entries(source.cardHealBonus)) {
    merged[k] = (merged[k] ?? 0) + v;
  }
  target.cardHealBonus = merged;
}

function mergeCompanionBonds(target: TalentEffectManifest, source: HomesteadEffectManifest): void {
  const merged = { ...target.companionBondLevels };
  for (const [k, v] of Object.entries(source.companionBondLevels)) {
    merged[k as keyof typeof merged] = Math.max(merged[k as keyof typeof merged] ?? 0, v);
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

  for (const key of HOMESTEAD_BATTLE_BOOLEAN_KEYS) {
    if (homesteadEffects[key]) {
      merged[key] = true;
    }
  }

  mergeCardHealBonus(merged, homesteadEffects);
  mergeCompanionBonds(merged, homesteadEffects);

  return merged;
}
