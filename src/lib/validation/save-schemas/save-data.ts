import { z } from "zod";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { hasHomesteadPurchases } from "@/lib/homestead/purchases";
import { companionTierItems } from "@/lib/homestead/companions";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_CONTENT_VERSION } from "../metadata";
import { resolveAutoplayEnabled } from "@/lib/settings-values";
import {
  deduplicatedSetArraySchema,
  deduplicatedStringArraySchema,
  isUsableLiveCombatGold,
  toSafeNonNegativeInt,
} from "./validation-utils";
import {
  CHARACTER_IDS,
  CharacterIdSchema,
  MATERIAL_ZERO_INVENTORY,
  CRAFTING_CURRENCY_ZERO_INVENTORY,
  createTierRecordSchema,
  CompletedDifficultiesSchema,
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
  createEmptyGearLoadout,
  createEmptyEquippedTrinkets,
  GEAR_CHARACTER_IDS,
  flattenGearInventories,
  type GearInventories,
  type GearLoadouts,
  type EquippedTrinkets,
} from "@/lib/gear/types";
import { SettingsSaveFieldsSchema } from "./settings";
import { pruneOrphanGearLoadouts } from "@/lib/gear/loadout-operations";

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
  .transform((inventories) => {
    const seen = new Set<string>();
    const unique = inventories as GearInventories;
    for (const characterId of GEAR_CHARACTER_IDS) {
      unique[characterId] = unique[characterId].filter((item) => {
        if (seen.has(item.instanceId)) return false;
        seen.add(item.instanceId);
        return true;
      });
    }
    return unique;
  });
const GearLoadoutSchema = z
  .object({
    "main-hand": z.string().nullable().catch(null),
    "off-hand": z.string().nullable().catch(null),
    body: z.string().nullable().catch(null),
    "left-accessory": z.string().nullable().catch(null),
    "right-accessory": z.string().nullable().catch(null),
  })
  .catch(createEmptyGearLoadout);
const GearLoadoutsSchema = z
  .object(characterShape(() => GearLoadoutSchema))
  .transform((loadouts) => loadouts as GearLoadouts);
const EquippedTrinketsSchema = z
  .object(characterShape(() => z.string().nullable().catch(null)))
  .catch(createEmptyEquippedTrinkets)
  .transform((value) => value as EquippedTrinkets);

function readRawCombatGold(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const save = value as Record<string, unknown>;
  const run = save.activeRun as { activity?: { kind?: unknown; data?: { battleState?: { gold?: unknown } } } } | null;
  const activity = run?.activity;
  return activity?.kind === "battle" ? activity.data?.battleState?.gold : undefined;
}

// Single owner for the live-combat-gold rule: the mid-fight purse override is
// intentional, not damage. save-candidates.ts uses this to suppress the gold
// repair warning instead of re-implementing the rounding comparison.
export function isCombatGoldOverride(liveCombatGold: unknown, persistedGold: number): boolean {
  return isUsableLiveCombatGold(liveCombatGold) && Math.round(liveCombatGold) === persistedGold;
}

const SaveDataObjectSchema = z
  .object({
    saveSchemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION).catch(CURRENT_SAVE_SCHEMA_VERSION),
    gameBuildVersion: z.string().catch(CURRENT_GAME_BUILD_VERSION),
    steamAccountId: z.string().regex(/^\d+$/u).nullable().catch(null),
    contentVersion: z.number().int().nonnegative().catch(CURRENT_CONTENT_VERSION),
    ...SettingsSaveFieldsSchema.shape,
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

    activeRun: ActiveRunDataSchema.nullable().catch(null),
    gold: z.number().int().nonnegative().catch(0),
    materialInventory: MaterialInventorySchema.catch(() => ({ ...MATERIAL_ZERO_INVENTORY })),
    starterHomesteadGrantResolved: z.boolean().optional().catch(undefined),
    craftingCurrencies: CraftingCurrencyInventorySchema.catch(() => ({ ...CRAFTING_CURRENCY_ZERO_INVENTORY })),
    constructedBuildings: createTierRecordSchema(buildings).catch(() => createEmptyTierRecord(buildings)),
    plantedFarms: createTierRecordSchema(farmPlots).catch(() => createEmptyTierRecord(farmPlots)),
    completedResearch: createTierRecordSchema(researchUpgrades).catch(() => createEmptyTierRecord(researchUpgrades)),
    bondedCompanions: createTierRecordSchema(companionTierItems).catch(() => createEmptyTierRecord(companionTierItems)),
    completedDifficulties: CompletedDifficultiesSchema.catch(EMPTY_COMPLETED_DIFFICULTIES),
    finishedRunCharacters: deduplicatedSetArraySchema(CHARACTER_IDS, CharacterIdSchema),
    // Single normalizer shared with getCandidateSavedAt (save-versions.ts):
    // fractional timestamps floor instead of resetting to 0, so candidate
    // freshness ordering agrees between the raw future check and this schema.
    lastSavedAt: z.preprocess((value) => toSafeNonNegativeInt(value) ?? value, z.number().int().nonnegative().catch(0)),
  })
  .transform((save) => {
    const flatInventory = flattenGearInventories(save.gearInventories);
    return {
      ...save,
      autoplayEnabled: resolveAutoplayEnabled(save),
      starterHomesteadGrantResolved: save.starterHomesteadGrantResolved ?? hasHomesteadPurchases(save),
      gearLoadouts: pruneOrphanGearLoadouts(flatInventory, save.gearLoadouts),
    };
  });

// Keep the raw candidate until validation proves the battle itself is usable.
// A repaired zero must never override a valid purse, and a rejected battle has
// no authority over permanent Gold even when its raw balance was valid.
export const SaveDataSchema = z
  .preprocess(
    (value) => ({ save: value, combatGold: readRawCombatGold(value) }),
    z.object({ save: SaveDataObjectSchema, combatGold: z.unknown() }),
  )
  .transform(({ save, combatGold }) => {
    const run = save.activeRun;
    if (run?.activity.kind !== "battle") return save;
    const gold = isUsableLiveCombatGold(combatGold) ? Math.round(combatGold) : save.gold;
    return {
      ...save,
      gold,
      activeRun: {
        ...run,
        activity: {
          ...run.activity,
          data: { battleState: { ...run.activity.data.battleState, gold } },
        },
      },
    };
  });

export type ParsedSaveData = z.output<typeof SaveDataSchema>;
