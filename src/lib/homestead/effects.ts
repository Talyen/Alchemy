import type { TalentEffectManifest } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "./types";
import { HOMESTEAD_BATTLE_NUMERIC_KEYS, HOMESTEAD_BATTLE_BOOLEAN_KEYS, HOMESTEAD_BATTLE_RECORD_KEYS } from "./types";
import { defaultHomesteadEffects } from "./defaults";
import { buildings, farmPlots, researchUpgrades } from "./data";

type HomesteadBattleRecordKey = (typeof HOMESTEAD_BATTLE_RECORD_KEYS)[number];

function applyTierEffects(base: HomesteadEffectManifest, partial?: Partial<HomesteadEffectManifest>): void {
  if (!partial) return;
  for (const key of Object.keys(partial) as Array<keyof HomesteadEffectManifest>) {
    const val = partial[key];
    if (typeof val === "number") {
      (base[key] as number) += val;
    } else if (typeof val === "boolean") {
      (base[key] as boolean) = (base[key] as boolean) || val;
    } else if (typeof val === "object") {
      const baseVal = base[key];
      if (typeof baseVal === "object") {
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
  items: Array<{ id: string; tiers: Array<{ effects?: Partial<HomesteadEffectManifest> }> }>,
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

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- generic preserves record key relation between target and source
function mergeRecordEffect<K extends HomesteadBattleRecordKey>(
  target: TalentEffectManifest,
  source: HomesteadEffectManifest,
  key: K,
): void {
  const sourceValue = source[key];
  if (Object.keys(sourceValue).length > 0) {
    target[key] = { ...target[key], ...sourceValue };
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

  effects.companionBondLevels = { ...effects.companionBondLevels };
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
    merged[key] += homesteadEffects[key];
  }

  for (const key of HOMESTEAD_BATTLE_BOOLEAN_KEYS) {
    if (homesteadEffects[key]) {
      merged[key] = true;
    }
  }

  for (const key of HOMESTEAD_BATTLE_RECORD_KEYS) {
    mergeRecordEffect(merged, homesteadEffects, key);
  }

  return merged;
}
