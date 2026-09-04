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
import { migrateSaveDataToCurrent } from "../migration";
import {
  CHARACTER_IDS,
  CharacterIdSchema,
  deduplicatedStringArraySchema,
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
} from "./core";
import { ActiveRunDataSchema } from "./active-run";
import { ParkedRunsSchema, RunRecencySchema } from "./parked-runs";
import { GearInstanceArraySchema } from "./gear-schemas";
import {
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  createEmptyEquippedTrinkets,
  flattenGearInventories,
  normalizeExclusiveGearLoadouts,
  normalizeGearLoadout,
  pruneOrphanGearLoadouts,
  type GearInventories,
  type GearLoadouts,
  type EquippedTrinkets,
} from "@/lib/gear/types";

function characterShape<T extends z.ZodType>(factory: (id: string) => T): Record<string, T> {
  const shape: Record<string, T> = {};
  for (const id of CHARACTER_IDS) shape[id] = factory(id);
  return shape;
}

const GearInventorySchema = GearInstanceArraySchema;
const emptyGearInventories = createEmptyGearInventories();
const GearInventoriesSchema = z
  .object(characterShape(() => GearInventorySchema.catch([])))
  .catch(emptyGearInventories)
  .transform((inventories) => inventories as GearInventories);
const GearLoadoutSchema = z
  .record(z.string(), z.union([z.string(), z.null()]))
  .catch({})
  .transform((raw) => normalizeGearLoadout(raw));
const emptyGearLoadouts = createEmptyGearLoadouts();
const GearLoadoutsSchema = z
  .object(characterShape((id) => GearLoadoutSchema.catch(emptyGearLoadouts[id as keyof typeof emptyGearLoadouts])))
  .transform((loadouts) => normalizeExclusiveGearLoadouts(loadouts as GearLoadouts));
const emptyEquippedTrinkets = createEmptyEquippedTrinkets();
const EquippedTrinketsSchema = z
  .object(characterShape(() => z.string().nullable().catch(null)))
  .catch(emptyEquippedTrinkets)
  .transform((value) => value as EquippedTrinkets);

function resolvePersistedGold(purseGold: number, liveCombatGold: unknown): number {
  return typeof liveCombatGold === "number" ? liveCombatGold : purseGold;
}

export const SaveDataSchema = z.preprocess(
  (raw) => migrateSaveDataToCurrent(raw),
  z
    .object({
      saveSchemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION).catch(CURRENT_SAVE_SCHEMA_VERSION),
      gameBuildVersion: z.string().catch(CURRENT_GAME_BUILD_VERSION),
      contentVersion: z.number().int().nonnegative().catch(CURRENT_CONTENT_VERSION),
      selectedAspectRatio: AspectRatioOptionSchema.catch("auto"),
      displayMode: DisplayModeSchema.catch("borderless-fullscreen"),
      brightness: z
        .number()
        .catch(DEFAULT_BRIGHTNESS_PCT)
        .transform((v) => Math.max(SETTINGS_RANGES.brightness.min, Math.min(SETTINGS_RANGES.brightness.max, v))),
      backgroundParticlesIntensity: z
        .number()
        .catch(DEFAULT_BACKGROUND_PARTICLES_PCT)
        .transform((v) =>
          Math.max(SETTINGS_RANGES.specialEffects.min, Math.min(SETTINGS_RANGES.specialEffects.max, v)),
        ),
      backgroundGlowIntensity: z
        .number()
        .catch(DEFAULT_BACKGROUND_GLOW_PCT)
        .transform((v) =>
          Math.max(SETTINGS_RANGES.specialEffects.min, Math.min(SETTINGS_RANGES.specialEffects.max, v)),
        ),
      discoveredCardIds: deduplicatedStringArraySchema(),
      encounteredEnemyIds: deduplicatedStringArraySchema(),
      discoveredTrinketIds: deduplicatedStringArraySchema(),
      discoveredUniqueIds: deduplicatedStringArraySchema(),
      gearInventories: GearInventoriesSchema.catch(emptyGearInventories),
      gearLoadouts: GearLoadoutsSchema.catch(emptyGearLoadouts),
      ownedTrinketIds: deduplicatedStringArraySchema(),
      equippedTrinkets: EquippedTrinketsSchema,
      talentXP: TalentXPSchema,
      unlockedTalents: UnlockedTalentsSchema,

      musicVolume: z
        .number()
        .catch(DEFAULT_MUSIC_VOLUME_PCT)
        .transform((v) => Math.max(SETTINGS_RANGES.volume.min, Math.min(SETTINGS_RANGES.volume.max, v))),
      sfxVolume: z
        .number()
        .catch(DEFAULT_SFX_VOLUME_PCT)
        .transform((v) => Math.max(SETTINGS_RANGES.volume.min, Math.min(SETTINGS_RANGES.volume.max, v))),
      masterVolume: z
        .number()
        .catch(DEFAULT_MASTER_VOLUME_PCT)
        .transform((v) => Math.max(SETTINGS_RANGES.volume.min, Math.min(SETTINGS_RANGES.volume.max, v))),
      muteInBackground: z.boolean().catch(true),
      autoEndTurn: z.boolean().catch(true),
      rememberAutoplayPreference: z.boolean().catch(false),
      autoplayEnabled: z.boolean().catch(false),
      activeRun: ActiveRunDataSchema.nullable().catch(null),
      parkedRuns: ParkedRunsSchema,
      runRecency: RunRecencySchema,
      gold: z.number().int().nonnegative().catch(0),
      materialInventory: MaterialInventorySchema.catch(MATERIAL_ZERO_INVENTORY),
      craftingCurrencies: CraftingCurrencyInventorySchema.catch(CRAFTING_CURRENCY_ZERO_INVENTORY),
      constructedBuildings: createTierRecordSchema(buildings).catch(createEmptyTierRecord(buildings)),
      plantedFarms: createTierRecordSchema(farmPlots).catch(createEmptyTierRecord(farmPlots)),
      completedResearch: createTierRecordSchema(researchUpgrades).catch(createEmptyTierRecord(researchUpgrades)),
      bondedCompanions: createTierRecordSchema(companionTierItems).catch(createEmptyTierRecord(companionTierItems)),
      completedDifficulties: CompletedDifficultiesSchema.catch(EMPTY_COMPLETED_DIFFICULTIES),
      finishedRunCharacters: z
        .preprocess((val) => {
          if (!Array.isArray(val)) return [];
          const validIds = new Set<string>(CHARACTER_IDS);
          return [...new Set(val.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
        }, z.array(CharacterIdSchema))
        .catch([]),
      lastSavedAt: z.number().int().nonnegative().catch(0),
    })
    .transform((save) => {
      const flatInventory = flattenGearInventories(save.gearInventories);
      return {
        ...save,
        gold: resolvePersistedGold(save.gold, save.activeRun?.activeCombat?.battleState.gold),
        autoplayEnabled: resolveAutoplayEnabled(save),
        gearLoadouts: pruneOrphanGearLoadouts(flatInventory, save.gearLoadouts),
      };
    }),
);

export type ParsedSaveData = z.output<typeof SaveDataSchema>;
