import { z } from "zod";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import {
  DEFAULT_BACKGROUND_GLOW_PCT,
  DEFAULT_BACKGROUND_PARTICLES_PCT,
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
} from "@/lib/game-constants";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_CONTENT_VERSION } from "../metadata";
import { SETTINGS_RANGES, resolveAutoplayEnabled } from "@/lib/settings-values";
import { deduplicatedSetArraySchema, deduplicatedStringArraySchema, isUsableLiveCombatGold } from "./validation-utils";
import {
  CHARACTER_IDS,
  CharacterIdSchema,
  MATERIAL_ZERO_INVENTORY,
  CRAFTING_CURRENCY_ZERO_INVENTORY,
  createTierRecordSchema,
  AspectRatioOptionSchema,
  CompletedDifficultiesSchema,
  DisplayModeSchema,
  MaterialInventorySchema,
  CraftingCurrencyInventorySchema,
  TalentXPSchema,
  UnlockedTalentsSchema,
  EMPTY_COMPLETED_DIFFICULTIES,
} from "./schema-enums";
import { ActiveRunDataSchema } from "./active-run";
import { GearInstanceArraySchema } from "./gear-schemas";
import {
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  createEmptyEquippedTrinkets,
  flattenGearInventories,
  normalizeExclusiveGearLoadouts,
  normalizeGearLoadout,
  type GearInventories,
  type GearLoadouts,
  type EquippedTrinkets,
} from "@/lib/gear/types";
import { clamp } from "@/lib/math";
import { pruneOrphanGearLoadouts } from "@/lib/gear/operations";

function clampedSettingSchema(defaultValue: number, range: { min: number; max: number }) {
  return z
    .number()
    .catch(defaultValue)
    .transform((v) => clamp(v, range.min, range.max));
}

function characterShape<T extends z.ZodType>(factory: (id: string) => T): Record<string, T> {
  const shape: Record<string, T> = {};
  for (const id of CHARACTER_IDS) shape[id] = factory(id);
  return shape;
}

const GearInventorySchema = GearInstanceArraySchema;
// Object-valued catch templates are factories so no two parses share
// containers: hydrate paths can alias parsed output into live state.
const GearInventoriesSchema = z
  .object(characterShape(() => GearInventorySchema.catch([])))
  .catch(createEmptyGearInventories)
  .transform((inventories) => inventories as GearInventories);
const GearLoadoutSchema = z
  .record(z.string(), z.union([z.string(), z.null()]))
  .catch({})
  .transform((raw) => normalizeGearLoadout(raw));
const emptyGearLoadouts = createEmptyGearLoadouts();
const GearLoadoutsSchema = z
  .object(characterShape((id) => GearLoadoutSchema.catch(emptyGearLoadouts[id as keyof typeof emptyGearLoadouts])))
  .transform((loadouts) => normalizeExclusiveGearLoadouts(loadouts as GearLoadouts));
const EquippedTrinketsSchema = z
  .object(characterShape(() => z.string().nullable().catch(null)))
  .catch(createEmptyEquippedTrinkets)
  .transform((value) => value as EquippedTrinkets);

function resolvePersistedGold(purseGold: number, liveCombatGold: unknown): number {
  if (isUsableLiveCombatGold(liveCombatGold)) {
    return Math.floor(liveCombatGold);
  }
  return purseGold;
}

// Single owner for the live-combat-gold rule: the mid-fight purse override is
// intentional, not damage. save-candidates.ts uses this to suppress the gold
// repair warning instead of re-implementing the floor comparison.
export function isCombatGoldOverride(liveCombatGold: unknown, persistedGold: number): boolean {
  return isUsableLiveCombatGold(liveCombatGold) && Math.floor(liveCombatGold) === persistedGold;
}

export const SaveDataSchema = z
  .object({
    saveSchemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION).catch(CURRENT_SAVE_SCHEMA_VERSION),
    gameBuildVersion: z.string().catch(CURRENT_GAME_BUILD_VERSION),
    contentVersion: z.number().int().nonnegative().catch(CURRENT_CONTENT_VERSION),
    selectedAspectRatio: AspectRatioOptionSchema.catch("auto"),
    displayMode: DisplayModeSchema.catch("borderless-fullscreen"),
    brightness: clampedSettingSchema(DEFAULT_BRIGHTNESS_PCT, SETTINGS_RANGES.brightness),
    backgroundParticlesIntensity: clampedSettingSchema(
      DEFAULT_BACKGROUND_PARTICLES_PCT,
      SETTINGS_RANGES.specialEffects,
    ),
    backgroundGlowIntensity: clampedSettingSchema(DEFAULT_BACKGROUND_GLOW_PCT, SETTINGS_RANGES.specialEffects),
    discoveredCardIds: deduplicatedStringArraySchema(),
    encounteredEnemyIds: deduplicatedStringArraySchema(),
    discoveredTrinketIds: deduplicatedStringArraySchema(),
    discoveredUniqueIds: deduplicatedStringArraySchema(),
    gearInventories: GearInventoriesSchema.catch(createEmptyGearInventories),
    gearLoadouts: GearLoadoutsSchema.catch(createEmptyGearLoadouts),
    ownedTrinketIds: deduplicatedStringArraySchema(),
    equippedTrinkets: EquippedTrinketsSchema,
    talentXP: TalentXPSchema,
    unlockedTalents: UnlockedTalentsSchema,

    musicVolume: clampedSettingSchema(DEFAULT_MUSIC_VOLUME_PCT, SETTINGS_RANGES.volume),
    sfxVolume: clampedSettingSchema(DEFAULT_SFX_VOLUME_PCT, SETTINGS_RANGES.volume),
    masterVolume: clampedSettingSchema(DEFAULT_MASTER_VOLUME_PCT, SETTINGS_RANGES.volume),
    muteInBackground: z.boolean().catch(true),
    autoEndTurn: z.boolean().catch(true),
    rememberAutoplayPreference: z.boolean().catch(false),
    autoplayEnabled: z.boolean().catch(false),
    activeRun: ActiveRunDataSchema.nullable().catch(null),
    gold: z.number().int().nonnegative().catch(0),
    materialInventory: MaterialInventorySchema.catch(() => ({ ...MATERIAL_ZERO_INVENTORY })),
    craftingCurrencies: CraftingCurrencyInventorySchema.catch(() => ({ ...CRAFTING_CURRENCY_ZERO_INVENTORY })),
    constructedBuildings: createTierRecordSchema(buildings).catch(() => createEmptyTierRecord(buildings)),
    plantedFarms: createTierRecordSchema(farmPlots).catch(() => createEmptyTierRecord(farmPlots)),
    completedResearch: createTierRecordSchema(researchUpgrades).catch(() => createEmptyTierRecord(researchUpgrades)),
    bondedCompanions: createTierRecordSchema(companionTierItems).catch(() => createEmptyTierRecord(companionTierItems)),
    completedDifficulties: CompletedDifficultiesSchema.catch(EMPTY_COMPLETED_DIFFICULTIES),
    finishedRunCharacters: deduplicatedSetArraySchema(CHARACTER_IDS, CharacterIdSchema),
    lastSavedAt: z.number().int().nonnegative().catch(0),
  })
  .transform((save) => {
    const flatInventory = flattenGearInventories(save.gearInventories);
    return {
      ...save,
      // Load-only repairs (encode never applies these): live combat gold
      // overrides the purse so a reloaded fight keeps its stakes, and orphan
      // loadout references are pruned against the restored inventory.
      // save-candidates.ts suppresses warnings for the gold override because
      // it is intentional, not damage.
      gold: resolvePersistedGold(save.gold, save.activeRun?.activeCombat?.battleState.gold),
      autoplayEnabled: resolveAutoplayEnabled(save),
      gearLoadouts: pruneOrphanGearLoadouts(flatInventory, save.gearLoadouts),
    };
  });

export type ParsedSaveData = z.output<typeof SaveDataSchema>;
