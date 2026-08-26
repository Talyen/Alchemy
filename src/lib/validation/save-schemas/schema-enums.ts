// Zod enum and record schemas for persisted save fields.
import { z } from "zod";
import {
  characters,
  DIFFICULTY_ORDER,
  normalizeUnlockedTalents,
  type CharacterId,
  type DifficultyId,
  type UnlockedTalents,
  DAMAGE_TYPES,
  ENEMY_TYPE_VALUES,
  PLAYER_STATUS_DISPLAY_ORDER,
  ENEMY_STATUS_DISPLAY_ORDER,
  type PlayerStatusId,
  type EnemyStatusId,
} from "@/lib/game-data";
import { CONTENT_SYSTEM_IDS } from "@/lib/content-systems/types";
import { EMPTY_CRAFTING_CURRENCIES, normalizeCraftingCurrencies } from "@/lib/gear/crafting";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { filterValidDestinations } from "@/lib/routing";
import { deduplicateStrings } from "./validation-utils";

function toNonEmptyTuple<T extends string>(values: readonly T[], label: string): [T, ...T[]] {
  if (values.length === 0) throw new Error(`${label} must define at least one value`);
  return values as [T, ...T[]];
}

export const CHARACTER_IDS = toNonEmptyTuple(Object.keys(characters) as CharacterId[], "Character IDs");
const DIFFICULTY_IDS = toNonEmptyTuple(DIFFICULTY_ORDER as readonly DifficultyId[], "Difficulty IDs");

export const MATERIAL_ZERO_INVENTORY = Object.fromEntries(MATERIAL_IDS.map((id) => [id, 0])) as Record<
  MaterialId,
  number
>;

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

export const DestinationArraySchema = z
  .array(z.string())
  .catch([])
  .transform((values) => filterValidDestinations(values));

const DAMAGE_TYPE_VALUES = toNonEmptyTuple(DAMAGE_TYPES, "Damage types");
const PLAYER_STATUS_IDS = toNonEmptyTuple(PLAYER_STATUS_DISPLAY_ORDER as PlayerStatusId[], "Player status IDs");
const ENEMY_STATUS_IDS = toNonEmptyTuple(ENEMY_STATUS_DISPLAY_ORDER as EnemyStatusId[], "Enemy status IDs");

export const DamageTypeSchema = z.enum(DAMAGE_TYPE_VALUES);
export const PlayerStatusIdSchema = z.enum(PLAYER_STATUS_IDS);
export const EnemyStatusIdSchema = z.enum(ENEMY_STATUS_IDS);
export const LabyrinthNodeTypeSchema = z.enum([
  "entrance",
  "combat",
  "elite",
  "rest",
  "mystery",
  "shop",
  "alchemist",
  "trinket-shop",
  "equipment-shop",
  "boss",
]);
export const LabyrinthNodeStateSchema = z.enum(["hidden", "visible", "current", "cleared", "failed"]);
export const AspectRatioOptionSchema = z.enum(["auto", "16:9", "16:10", "21:9"]);
export const DisplayModeSchema = z.enum(["windowed", "borderless-fullscreen", "fullscreen"]);

export const CRAFTING_CURRENCY_ZERO_INVENTORY = { ...EMPTY_CRAFTING_CURRENCIES };

export const CraftingCurrencyInventorySchema = z
  .record(z.string(), z.unknown())
  .catch(CRAFTING_CURRENCY_ZERO_INVENTORY)
  .transform((inventory) => normalizeCraftingCurrencies(inventory));

export const MaterialInventorySchema = z.object(createMaterialInventoryShape()).catch(MATERIAL_ZERO_INVENTORY);

export const TalentXPSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, xp] of Object.entries(val as Record<string, unknown>)) {
    if (typeof xp === "number" && Number.isFinite(xp) && xp >= 0) {
      result[key] = Math.floor(xp);
    } else {
      console.warn(
        `[Save Validation] Talent XP for key "${key}" dropped: expected a non-negative finite number, got ${typeof xp === "number" ? String(xp) : typeof xp}`,
      );
    }
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

const DIFFICULTY_ID_SET = new Set<string>(DIFFICULTY_IDS);

function normalizeCompletedDifficulties(data: Record<string, string[]>): Record<CharacterId, DifficultyId[]> {
  const result = {} as Record<CharacterId, DifficultyId[]>;
  for (const characterId of CHARACTER_IDS) {
    const raw = data[characterId] ?? [];
    result[characterId] = [...new Set(raw.filter((id): id is DifficultyId => DIFFICULTY_ID_SET.has(id)))];
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
    result[id] = typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  }
  return result;
}

function normalizeTierRecordInput(val: unknown): Record<string, number> {
  if (Array.isArray(val)) return normalizeArrayInput(val);
  if (val && typeof val === "object") return normalizeObjectInput(val as Record<string, unknown>);
  return {};
}

function clampTierLevels<T extends string>(
  data: Record<string, number>,
  items: ReadonlyArray<{ id: T; tiers: readonly unknown[] }>,
  validIds: T[],
): Record<T, number> {
  const result: Record<T, number> = {} as Record<T, number>;
  for (const id of validIds) {
    const maxTier = items.find((item) => item.id === id)?.tiers.length ?? 0;
    result[id] = Math.min(maxTier, Math.max(0, data[id] ?? 0));
  }
  return result;
}

export function createTierRecordSchema<T extends string>(
  items: ReadonlyArray<{ id: T; tiers: readonly unknown[] }>,
): z.ZodType<Record<T, number>> {
  const validIds = items.map((item) => item.id);
  return z
    .preprocess((val) => normalizeTierRecordInput(val), z.record(z.string(), z.number().int().nonnegative().catch(0)))
    .transform((data) => clampTierLevels(data, items, validIds));
}
