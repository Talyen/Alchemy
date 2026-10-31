import { expect, it } from "vitest";
import { DEFAULT_TALENT_EFFECTS, createEmptyTalentEffectManifest } from "@/lib/game-data/talents/manifest-defaults";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { defaultTrinketEffects, computeTrinketManifest, getTrinketEffectValue } from "@/lib/trinkets";
import { defaultBattleState } from "@/lib/battle";
import { createEmptyGearEffectManifest, GEAR_CHANCE_EFFECT_KEYS, GEAR_NUMERIC_EFFECT_KEYS } from "@/lib/gear";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";
import {
  canBondCompanion,
  companionSummonCardId,
  companionTierItems,
  COMPANION_BOND_TIERS,
} from "@/lib/homestead/companions";
import { emptyInventory } from "@/lib/homestead/inventory";
import { tryUpgradeTierItem } from "@/lib/homestead/upgrades";

it("shared Talent defaults cannot grant unearned bonuses to later manifests", () => {
  const original = structuredClone(DEFAULT_TALENT_EFFECTS);
  try {
    Reflect.set(DEFAULT_TALENT_EFFECTS, "startForge", 99);
    Reflect.set(DEFAULT_TALENT_EFFECTS.companionBondLevels, "wolf", 3);
    Reflect.set(DEFAULT_TALENT_EFFECTS.healthThresholdArmor, "0", { threshold: 50, amount: 99 });
    expect(createEmptyTalentEffectManifest()).toEqual(original);
    const owned = createEmptyTalentEffectManifest();
    owned.companionBondLevels.wolf = 2;
    owned.healthThresholdArmor.push({ threshold: 50, amount: 2 });
    expect(createEmptyTalentEffectManifest()).toEqual(original);
  } finally {
    Reflect.set(DEFAULT_TALENT_EFFECTS, "startForge", original.startForge);
    Reflect.set(DEFAULT_TALENT_EFFECTS.companionBondLevels, "wolf", original.companionBondLevels.wolf);
    Reflect.set(DEFAULT_TALENT_EFFECTS.healthThresholdArmor, "length", original.healthThresholdArmor.length);
  }
});

it("shared Homestead defaults cannot grant buildings or Companion Bonds to a new career", () => {
  const original = structuredClone(defaultHomesteadEffects);
  try {
    Reflect.set(defaultHomesteadEffects, "homesteadPhysicalCritDamagePercent", 99);
    Reflect.set(defaultHomesteadEffects.companionBondLevels, "wolf", 3);
    expect(computeHomesteadEffects({}, {}, {})).toEqual(original);
    const owned = computeHomesteadEffects({}, {}, {});
    owned.companionBondLevels.wolf = 2;
    expect(computeHomesteadEffects({}, {}, {})).toEqual(original);
  } finally {
    Reflect.set(
      defaultHomesteadEffects,
      "homesteadPhysicalCritDamagePercent",
      original.homesteadPhysicalCritDamagePercent,
    );
    Reflect.set(defaultHomesteadEffects.companionBondLevels, "wolf", original.companionBondLevels.wolf);
  }
});

it("shared Trinket defaults cannot give unequipped heroes kill healing", () => {
  const original = defaultTrinketEffects.boneCharmHealOnKill;
  try {
    Reflect.set(defaultTrinketEffects, "boneCharmHealOnKill", 99);
    expect(computeTrinketManifest([]).boneCharmHealOnKill).toBe(original);
    expect(getTrinketEffectValue([], "boneCharmHealOnKill")).toBe(original);
    expect(defaultBattleState().trinketEffects.boneCharmHealOnKill).toBe(original);
    const owned = computeTrinketManifest([]);
    owned.boneCharmHealOnKill = 5;
    expect(computeTrinketManifest([]).boneCharmHealOnKill).toBe(original);
  } finally {
    Reflect.set(defaultTrinketEffects, "boneCharmHealOnKill", original);
  }
});

it("shared Gear key lists cannot remove effects from fresh or restored manifests", () => {
  const numericKey = GEAR_NUMERIC_EFFECT_KEYS[0]!;
  const chanceKey = GEAR_CHANCE_EFFECT_KEYS[0]!;
  try {
    Reflect.set(GEAR_NUMERIC_EFFECT_KEYS, "0", "unknown-effect");
    Reflect.set(GEAR_CHANCE_EFFECT_KEYS, "0", "unknown-chances");
    expect(createEmptyGearEffectManifest()[chanceKey]).toEqual([]);
    const saved = defaultBattleState();
    saved.gearEffects[numericKey] = 7;
    saved.gearEffects[chanceKey] = [25];
    const resumed = normalizePersistedBattleState(saved);
    expect(resumed.gearEffects[numericKey]).toBe(7);
    expect(resumed.gearEffects[chanceKey]).toEqual([25]);
  } finally {
    Reflect.set(GEAR_NUMERIC_EFFECT_KEYS, "0", numericKey);
    Reflect.set(GEAR_CHANCE_EFFECT_KEYS, "0", chanceKey);
  }
});

it("Companion price reads cannot turn a later Bond purchase into a free upgrade", () => {
  const cost = COMPANION_BOND_TIERS[0]!;
  const item = companionTierItems.find((entry) => entry.id === "wolf")!;
  const original = cost.food;
  try {
    Reflect.set(cost, "food", 0);
    Reflect.set(item.tiers[0]!.cost, "food", 0);
    const inventory = emptyInventory();
    expect(canBondCompanion("wolf", [companionSummonCardId("wolf")!], {}, inventory)).toBe(false);
    expect(tryUpgradeTierItem(item, 0, inventory).ok).toBe(false);
    expect(tryUpgradeTierItem(item, 0, { ...inventory, food: original })).toMatchObject({
      ok: true,
      nextLevel: 1,
      inventory: { food: 0 },
    });
  } finally {
    Reflect.set(cost, "food", original);
    Reflect.set(item.tiers[0]!.cost, "food", original);
  }
});
