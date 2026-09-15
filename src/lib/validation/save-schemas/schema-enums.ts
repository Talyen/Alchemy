import { CONTENT_SYSTEM_IDS } from "@/lib/content-systems/types";
import {
  characters,
  DIFFICULTY_ORDER,
  ENEMY_STATUS_DISPLAY_ORDER,
  ENEMY_TYPE_VALUES,
  normalizeUnlockedTalents,
  type CharacterId,
  type DifficultyId,
  type EnemyStatusId,
  type UnlockedTalents,
} from "@/lib/game-data";
import { EMPTY_CRAFTING_CURRENCIES, normalizeCraftingCurrencies } from "@/lib/gear/crafting-ids";
import { emptyInventory } from "@/lib/homestead/inventory";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { filterValidDestinations } from "@/lib/routing";
import { ASPECT_RATIO_VALUES, DISPLAY_MODE_VALUES } from "@/lib/settings-values";
import { z } from "zod";
import { clamp } from "@/lib/math";
import { deduplicateFromSet, deduplicateStrings, toFiniteNonNegativeInt } from "./validation-utils";

function toNonEmptyTuple<T extends string>(values: readonly T[], label: string): [T, ...T[]] {
  if (values.length === 0) throw new Error(`${label} must define at least one value`);
  return values as [T, ...T[]];
}

export const CHARACTER_IDS = toNonEmptyTuple(Object.keys(characters) as CharacterId[], "Character IDs");
const DIFFICULTY_IDS = toNonEmptyTuple(DIFFICULTY_ORDER as readonly DifficultyId[], "Difficulty IDs");

export const MATERIAL_ZERO_INVENTORY = emptyInventory();

function createMaterialInventoryShape() {
  return MATERIAL_IDS.reduce(
    (shape, id) => ({ ...shape, [id]: z.number().int().nonnegative().catch(0) }),
    {} as Record<MaterialId, z.ZodCatch<z.ZodNumber>>,
  );
}

export const CharacterIdSchema = z.enum(CHARACTER_IDS);
export const DifficultyIdSchema = z.enum(DIFFICULTY_IDS);
export const ContentSystemIdSchema = z.enum(CONTENT_SYSTEM_IDS);
export const EnemyTypeSchema = z.enum(ENEMY_TYPE_VALUES);
export const MaterialIdSchema = z.enum(MATERIAL_IDS);

export const DestinationArraySchema = z
  .array(z.string())
  .catch([])
  .transform((values) => filterValidDestinations(values));

const ENEMY_STATUS_IDS = toNonEmptyTuple(ENEMY_STATUS_DISPLAY_ORDER as EnemyStatusId[], "Enemy status IDs");

// Stable id list for content lint without reaching into zod internals (.options).
export const ENEMY_STATUS_IDS_LIST: readonly string[] = ENEMY_STATUS_IDS;
export const LabyrinthNodeTypeSchema = z.enum([
  "entrance",
  "combat",
  "elite",
  "rest",
  "mystery",
  "corruption",
  "shop",
  "alchemist",
  "trinket-shop",
  "equipment-shop",
  "boss",
]);
export const AspectRatioOptionSchema = z.enum(ASPECT_RATIO_VALUES);
export const DisplayModeSchema = z.enum(DISPLAY_MODE_VALUES);

export const CRAFTING_CURRENCY_ZERO_INVENTORY = EMPTY_CRAFTING_CURRENCIES;

export const CraftingCurrencyInventorySchema = z
  .record(z.string(), z.unknown())
  .catch(CRAFTING_CURRENCY_ZERO_INVENTORY)
  .transform((inventory) => normalizeCraftingCurrencies(inventory));

export const MaterialInventorySchema = z.object(createMaterialInventoryShape()).catch(() => emptyInventory());

export const TalentXPSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, xp] of Object.entries(val as Record<string, unknown>)) {
    const floored = toFiniteNonNegativeInt(xp);
    if (floored !== null) result[key] = floored;
  }
  return result;
}, z.record(z.string(), z.number().int().nonnegative()).catch({}));

function recordOfStringArraysSchema(defaultFactory?: () => Record<string, string[]>) {
  return z.preprocess(
    (val) => {
      if (!val || typeof val !== "object") return defaultFactory?.() ?? {};
      const result: Record<string, string[]> = { ...(defaultFactory?.() ?? {}) };
      for (const [key, ids] of Object.entries(val as Record<string, unknown>)) {
        if (Array.isArray(ids)) {
          result[key] = deduplicateStrings(ids);
        } else if (defaultFactory) {
          result[key] = result[key] ?? [];
        }
      }
      return result;
    },
    z.record(z.string(), z.array(z.string())).catch({}),
  );
}

export const UnlockedTalentsSchema = recordOfStringArraysSchema().transform((data) =>
  normalizeUnlockedTalents(data as UnlockedTalents),
);

const DIFFICULTY_ID_SET = new Set<DifficultyId>(DIFFICULTY_IDS);

function normalizeCompletedDifficulties(data: Record<string, string[]>): Record<CharacterId, DifficultyId[]> {
  const result = {} as Record<CharacterId, DifficultyId[]>;
  for (const characterId of CHARACTER_IDS) {
    result[characterId] = deduplicateFromSet(data[characterId], DIFFICULTY_ID_SET);
  }
  return result;
}

export const CompletedDifficultiesSchema = recordOfStringArraysSchema(() =>
  Object.fromEntries(CHARACTER_IDS.map((id) => [id, [] as string[]])),
).transform(normalizeCompletedDifficulties);

export const EMPTY_COMPLETED_DIFFICULTIES: Record<CharacterId, DifficultyId[]> = normalizeCompletedDifficulties(
  Object.fromEntries(CHARACTER_IDS.map((id) => [id, []])),
);

function normalizeArrayInput(arr: unknown[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const rawId of arr) {
    const id = typeof rawId === "string" ? rawId : String(rawId);
    result[id] = (result[id] ?? 0) + 1;
  }
  return result;
}

function normalizeObjectInput(obj: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [id, level] of Object.entries(obj)) {
    result[id] = toFiniteNonNegativeInt(level) ?? 0;
  }
  return result;
}

function normalizeTierRecordInput(val: unknown): Record<string, number> {
  if (Array.isArray(val)) return normalizeArrayInput(val);
  if (val && typeof val === "object") return normalizeObjectInput(val as Record<string, unknown>);
  return {};
}

export function createTierRecordSchema<T extends string>(
  items: ReadonlyArray<{ id: T; tiers: readonly unknown[] }>,
): z.ZodType<Record<T, number>> {
  const maxTierById = new Map<T, number>(items.map((item) => [item.id, item.tiers.length]));
  const validIds = items.map((item) => item.id);
  return z
    .preprocess((val) => normalizeTierRecordInput(val), z.record(z.string(), z.number().int().nonnegative().catch(0)))
    .transform((data) => {
      const result: Record<T, number> = {} as Record<T, number>;
      for (const id of validIds) {
        const maxTier = maxTierById.get(id) ?? 0;
        result[id] = clamp(data[id] ?? 0, 0, maxTier);
      }
      return result;
    });
}
