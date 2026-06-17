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
  createTierRecordSchema,
  AspectRatioOptionSchema,
  CompletedDifficultiesSchema,
  DisplayModeSchema,
  MaterialInventorySchema,
  TalentXPSchema,
  UiScaleSchema,
  UnlockedTalentsSchema,
} from "./core";
import { ActiveRunDataSchema } from "./active-run";
import { GearInstanceArraySchema } from "./gear-schemas";
import {
  createEmptyGearLoadouts,
  normalizeExclusiveGearLoadouts,
  normalizeGearLoadout,
  pruneOrphanGearLoadouts,
  type GearBoardPositions,
  type GearLoadouts,
} from "@/lib/gear/types";
import { sanitizeGearBoardPositions } from "@/lib/gear/inventory-layout";

const GearInventorySchema = GearInstanceArraySchema;
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
      gearInventory: caught(GearInventorySchema, [], "gearInventory"),
      gearLoadouts: caught(GearLoadoutsSchema, emptyGearLoadouts, "gearLoadouts"),
      gearBoardPositions: caught(GearBoardPositionsSchema, {}, "gearBoardPositions"),
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
    .transform((save) => ({
      ...save,
      gearLoadouts: pruneOrphanGearLoadouts(save.gearInventory, save.gearLoadouts),
      gearBoardPositions: sanitizeGearBoardPositions(save.gearBoardPositions, save.gearInventory),
    })),
);
