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
} from "@/lib/gear/board-position-sanitizers";
import {
  createEmptyCurrencyBoardPositionsByCharacter,
  type CraftingCurrencyBoardPositions,
  type CraftingCurrencyBoardPositionsByCharacter,
} from "@/lib/gear/crafting";

const GearInventorySchema = GearInstanceArraySchema;
const emptyGearInventories = createEmptyGearInventories();
const emptyGearBoardPositionsByCharacter = createEmptyGearBoardPositionsByCharacter();
const emptyCurrencyBoardPositionsByCharacter = createEmptyCurrencyBoardPositionsByCharacter();
const gearInventoriesShape: Record<string, z.ZodType> = {};
for (const id of CHARACTER_IDS) {
  gearInventoriesShape[id] = GearInventorySchema.catch([]);
}
const GearInventoriesSchema = z
  .object(gearInventoriesShape)
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

const gearBoardPositionsShape: Record<string, z.ZodType> = {};
for (const id of CHARACTER_IDS) {
  gearBoardPositionsShape[id] = GearBoardPositionsSchema.catch({});
}
const GearBoardPositionsByCharacterSchema = z
  .object(gearBoardPositionsShape)
  .catch(emptyGearBoardPositionsByCharacter)
  .transform((positions) => positions as GearBoardPositionsByCharacter);

const craftingCurrencyBoardPositionsShape: Record<string, z.ZodType> = {};
for (const id of CHARACTER_IDS) {
  craftingCurrencyBoardPositionsShape[id] = CraftingCurrencyBoardPositionsSchema.catch({});
}
const CraftingCurrencyBoardPositionsByCharacterSchema = z
  .object(craftingCurrencyBoardPositionsShape)
  .catch(emptyCurrencyBoardPositionsByCharacter)
  .transform((positions) => positions as CraftingCurrencyBoardPositionsByCharacter);

const gearLoadoutsShape: Record<string, z.ZodType> = {};
for (const id of CHARACTER_IDS) {
  gearLoadoutsShape[id] = GearLoadoutSchema.catch(emptyGearLoadouts[id]);
}
const GearLoadoutsSchema = z
  .object(gearLoadoutsShape)
  .transform((loadouts) => normalizeExclusiveGearLoadouts(loadouts as GearLoadouts));

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
        .transform((v) => Math.max(50, Math.min(150, v))),
      discoveredCardIds: deduplicatedStringArraySchema(),
      encounteredEnemyIds: deduplicatedStringArraySchema(),
      discoveredTrinketIds: deduplicatedStringArraySchema(),
      gearInventories: GearInventoriesSchema.catch(emptyGearInventories),
      gearLoadouts: GearLoadoutsSchema.catch(emptyGearLoadouts),
      gearBoardPositionsByCharacter: GearBoardPositionsByCharacterSchema.catch(emptyGearBoardPositionsByCharacter),
      craftingCurrencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacterSchema.catch(
        emptyCurrencyBoardPositionsByCharacter,
      ),
      talentXP: TalentXPSchema,
      unlockedTalents: UnlockedTalentsSchema,
      // .catch() fallbacks must match defaults.ts — both come from game-constants.ts.
      musicVolume: z
        .number()
        .catch(DEFAULT_MUSIC_VOLUME_PCT)
        .transform((v) => Math.max(0, Math.min(100, v))),
      sfxVolume: z
        .number()
        .catch(DEFAULT_SFX_VOLUME_PCT)
        .transform((v) => Math.max(0, Math.min(100, v))),
      masterVolume: z
        .number()
        .catch(DEFAULT_MASTER_VOLUME_PCT)
        .transform((v) => Math.max(0, Math.min(100, v))),
      muteInBackground: z.boolean().catch(true),
      autoEndTurn: z.boolean().catch(true),
      activeRun: ActiveRunDataSchema.nullable().catch(null),
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
        gearLoadouts: pruneOrphanGearLoadouts(flatInventory, save.gearLoadouts),
        gearBoardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(
          save.gearBoardPositionsByCharacter,
          save.gearInventories,
          save.gearLoadouts,
        ),
        craftingCurrencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
          save.craftingCurrencyBoardPositionsByCharacter,
          save.craftingCurrencies,
        ),
      };
    }),
);

export type ParsedSaveData = z.output<typeof SaveDataSchema>;
