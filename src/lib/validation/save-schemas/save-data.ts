// Top-level save blob schema composition.
import { z } from "zod";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import {
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
} from "@/lib/game-constants";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_CONTENT_VERSION } from "../metadata";
import { migrateSaveDataToCurrent } from "../migration";
import {
  caught,
  CHARACTER_IDS,
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
  UiScaleSchema,
  UnlockedTalentsSchema,
} from "./core";
import { ActiveRunDataSchema } from "./active-run";
import { GearInstanceArraySchema } from "./gear-schemas";
import {
  createEmptyGearInventories,
  createEmptyGearBoardPositionsByCharacter,
  createEmptyGearLoadouts,
  flattenGearInventories,
  normalizeExclusiveGearLoadouts,
  normalizeGearLoadout,
  pruneOrphanGearLoadouts,
  type GearBoardPositions,
  type GearBoardPositionsByCharacter,
  type GearInventories,
  type GearLoadouts,
} from "@/lib/gear/types";
import {
  sanitizeGearBoardPositionsByCharacter,
  sanitizeCurrencyBoardPositionsByCharacter,
} from "@/lib/gear/inventory-layout";
import {
  createEmptyCurrencyBoardPositionsByCharacter,
  type CraftingCurrencyBoardPositions,
  type CraftingCurrencyBoardPositionsByCharacter,
} from "@/lib/gear/crafting";

const GearInventorySchema = GearInstanceArraySchema;
const emptyGearInventories = createEmptyGearInventories();
const emptyGearBoardPositionsByCharacter = createEmptyGearBoardPositionsByCharacter();
const emptyCurrencyBoardPositionsByCharacter = createEmptyCurrencyBoardPositionsByCharacter();
const GearInventoriesSchema = z
  .object(
    Object.fromEntries(CHARACTER_IDS.map((id) => [id, GearInventorySchema.catch([])])) as unknown as Record<
      (typeof CHARACTER_IDS)[number],
      z.ZodType
    >,
  )
  .catch(emptyGearInventories)
  .transform((inventories) => inventories as GearInventories);
const GearLoadoutSchema = z
  .record(z.string(), z.union([z.string(), z.null()]))
  .catch({})
  .transform((raw) => normalizeGearLoadout(raw));
const emptyGearLoadouts = createEmptyGearLoadouts();
const GearBoardPositionsSchema = z
  .record(
    z.string(),
    z.object({
      col: z.number().int().nonnegative(),
      row: z.number().int().nonnegative(),
    }),
  )
  .catch({})
  .transform((positions) => positions as GearBoardPositions);

const CraftingCurrencyBoardPositionsSchema = z
  .record(
    z.string(),
    z.object({
      col: z.number().int().nonnegative(),
      row: z.number().int().nonnegative(),
    }),
  )
  .catch({})
  .transform((positions) => positions as CraftingCurrencyBoardPositions);

const GearBoardPositionsByCharacterSchema = z
  .object(
    Object.fromEntries(CHARACTER_IDS.map((id) => [id, GearBoardPositionsSchema.catch({})])) as unknown as Record<
      (typeof CHARACTER_IDS)[number],
      z.ZodType
    >,
  )
  .catch(emptyGearBoardPositionsByCharacter)
  .transform((positions) => positions as GearBoardPositionsByCharacter);

const CraftingCurrencyBoardPositionsByCharacterSchema = z
  .object(
    Object.fromEntries(
      CHARACTER_IDS.map((id) => [id, CraftingCurrencyBoardPositionsSchema.catch({})]),
    ) as unknown as Record<(typeof CHARACTER_IDS)[number], z.ZodType>,
  )
  .catch(emptyCurrencyBoardPositionsByCharacter)
  .transform((positions) => positions as CraftingCurrencyBoardPositionsByCharacter);

const GearLoadoutsSchema = z
  .object(
    Object.fromEntries(
      CHARACTER_IDS.map((id) => [id, GearLoadoutSchema.catch(emptyGearLoadouts[id])]),
    ) as unknown as Record<(typeof CHARACTER_IDS)[number], z.ZodType>,
  )
  .transform((loadouts) => normalizeExclusiveGearLoadouts(loadouts as GearLoadouts));

export const SaveDataSchema = z.preprocess(
  (raw) => migrateSaveDataToCurrent(raw),
  z
    .object({
      saveSchemaVersion: caught(
        z.literal(CURRENT_SAVE_SCHEMA_VERSION),
        CURRENT_SAVE_SCHEMA_VERSION,
        "saveSchemaVersion",
      ),
      gameBuildVersion: caught(z.string(), CURRENT_GAME_BUILD_VERSION, "gameBuildVersion"),
      contentVersion: caught(z.number().int().nonnegative(), CURRENT_CONTENT_VERSION, "contentVersion"),
      selectedAspectRatio: caught(AspectRatioOptionSchema, "auto", "selectedAspectRatio"),
      displayMode: caught(DisplayModeSchema, "borderless-fullscreen", "displayMode"),
      uiScale: caught(UiScaleSchema, "100", "uiScale"),
      brightness: caught(z.number().finite(), DEFAULT_BRIGHTNESS_PCT, "brightness").transform((v) =>
        Math.max(50, Math.min(150, v)),
      ),
      discoveredCardIds: deduplicatedStringArraySchema("discoveredCardIds"),
      encounteredEnemyIds: deduplicatedStringArraySchema("encounteredEnemyIds"),
      discoveredTrinketIds: deduplicatedStringArraySchema("discoveredTrinketIds"),
      gearInventories: caught(GearInventoriesSchema, emptyGearInventories, "gearInventories"),
      gearLoadouts: caught(GearLoadoutsSchema, emptyGearLoadouts, "gearLoadouts"),
      gearBoardPositionsByCharacter: caught(
        GearBoardPositionsByCharacterSchema,
        emptyGearBoardPositionsByCharacter,
        "gearBoardPositionsByCharacter",
      ),
      craftingCurrencyBoardPositionsByCharacter: caught(
        CraftingCurrencyBoardPositionsByCharacterSchema,
        emptyCurrencyBoardPositionsByCharacter,
        "craftingCurrencyBoardPositionsByCharacter",
      ),
      talentXP: TalentXPSchema,
      unlockedTalents: UnlockedTalentsSchema,
      // .catch() fallbacks must match defaults.ts — both come from game-constants.ts.
      musicVolume: caught(z.number().finite(), DEFAULT_MUSIC_VOLUME_PCT, "musicVolume").transform((v) =>
        Math.max(0, Math.min(100, v)),
      ),
      sfxVolume: caught(z.number().finite(), DEFAULT_SFX_VOLUME_PCT, "sfxVolume").transform((v) =>
        Math.max(0, Math.min(100, v)),
      ),
      masterVolume: caught(z.number().finite(), DEFAULT_MASTER_VOLUME_PCT, "masterVolume").transform((v) =>
        Math.max(0, Math.min(100, v)),
      ),
      muteInBackground: caught(z.boolean(), true, "muteInBackground"),
      autoEndTurn: caught(z.boolean(), true, "autoEndTurn"),
      activeRun: caught(ActiveRunDataSchema.nullable(), null, "activeRun"),
      materialInventory: caught(MaterialInventorySchema, MATERIAL_ZERO_INVENTORY, "materialInventory"),
      craftingCurrencies: caught(
        CraftingCurrencyInventorySchema,
        CRAFTING_CURRENCY_ZERO_INVENTORY,
        "craftingCurrencies",
      ),
      constructedBuildings: caught(
        createTierRecordSchema(buildings, { smithy: "blacksmiths-forge" }),
        createEmptyTierRecord(buildings),
        "constructedBuildings",
      ),
      plantedFarms: caught(
        createTierRecordSchema(farmPlots, { "sheep-pasture": "pasture" }),
        createEmptyTierRecord(farmPlots),
        "plantedFarms",
      ),
      completedResearch: caught(
        createTierRecordSchema(researchUpgrades),
        createEmptyTierRecord(researchUpgrades),
        "completedResearch",
      ),
      bondedCompanions: caught(
        createTierRecordSchema(companionTierItems),
        createEmptyTierRecord(companionTierItems),
        "bondedCompanions",
      ),
      completedDifficulties: caught(
        CompletedDifficultiesSchema,
        Object.fromEntries(CHARACTER_IDS.map((id) => [id, []])),
        "completedDifficulties",
      ),
      finishedRunCharacters: caught(z.array(z.string()), [], "finishedRunCharacters"),
      lastSavedAt: caught(z.number().int().nonnegative(), 0, "lastSavedAt"),
    })
    .transform((save) => {
      const flatInventory = flattenGearInventories(save.gearInventories);
      return {
        ...save,
        gearLoadouts: pruneOrphanGearLoadouts(flatInventory, save.gearLoadouts),
        gearBoardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(
          save.gearBoardPositionsByCharacter,
          save.gearInventories,
        ),
        craftingCurrencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
          save.craftingCurrencyBoardPositionsByCharacter,
          save.craftingCurrencies,
        ),
      };
    }),
);
