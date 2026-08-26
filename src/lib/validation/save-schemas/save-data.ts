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

const GearInventorySchema = GearInstanceArraySchema;
const emptyGearInventories = createEmptyGearInventories();
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
const gearLoadoutsShape: Record<string, z.ZodType> = {};
for (const id of CHARACTER_IDS) {
  gearLoadoutsShape[id] = GearLoadoutSchema.catch(emptyGearLoadouts[id]);
}
const GearLoadoutsSchema = z
  .object(gearLoadoutsShape)
  .transform((loadouts) => normalizeExclusiveGearLoadouts(loadouts as GearLoadouts));
const emptyEquippedTrinkets = createEmptyEquippedTrinkets();
const equippedTrinketsShape: Record<string, z.ZodType> = {};
for (const id of CHARACTER_IDS) {
  equippedTrinketsShape[id] = z.string().nullable().catch(null);
}
const EquippedTrinketsSchema = z
  .object(equippedTrinketsShape)
  .catch(emptyEquippedTrinkets)
  .transform((value) => value as EquippedTrinkets);

function leftoverActiveRunGold(activeRun: unknown): number {
  if (!activeRun || typeof activeRun !== "object") return 0;
  const value = (activeRun as { runGold?: unknown }).runGold;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function omitActiveRunGold(activeRun: unknown): unknown {
  if (!activeRun || typeof activeRun !== "object") return activeRun;
  const { runGold: _runGold, ...rest } = activeRun as Record<string, unknown>;
  void _runGold;
  return rest;
}

function migrateLegacyRunGoldEnvelope(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const save = raw as Record<string, unknown>;
  const leftover = leftoverActiveRunGold(save.activeRun);
  const gold = typeof save.gold === "number" && Number.isFinite(save.gold) ? save.gold : 0;
  const parked = save.parkedRuns;
  const nextParked =
    parked && typeof parked === "object"
      ? Object.fromEntries(
          Object.entries(parked as Record<string, unknown>).map(([mode, slot]) => [mode, omitActiveRunGold(slot)]),
        )
      : parked;
  return {
    ...save,
    gold: leftover > 0 ? leftover : gold,
    activeRun: omitActiveRunGold(save.activeRun),
    parkedRuns: nextParked,
  };
}

export const SaveDataSchema = z.preprocess(
  (raw) => migrateLegacyRunGoldEnvelope(migrateSaveDataToCurrent(raw)),
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
      discoveredUniqueIds: deduplicatedStringArraySchema(),
      gearInventories: GearInventoriesSchema.catch(emptyGearInventories),
      gearLoadouts: GearLoadoutsSchema.catch(emptyGearLoadouts),
      ownedTrinketIds: deduplicatedStringArraySchema(),
      equippedTrinkets: EquippedTrinketsSchema,
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
      const liveCombatGold = save.activeRun?.activeCombat?.battleState.gold;
      let migratedGold = save.gold;
      if (typeof liveCombatGold === "number") {
        migratedGold = liveCombatGold;
      }
      return {
        ...save,
        gold: migratedGold,
        autoplayEnabled: save.rememberAutoplayPreference && save.autoplayEnabled,
        gearLoadouts: pruneOrphanGearLoadouts(flatInventory, save.gearLoadouts),
      };
    }),
);

export type ParsedSaveData = z.output<typeof SaveDataSchema>;
