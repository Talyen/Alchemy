// Zod enum and record schemas for persisted save fields.
import { z } from "zod";
import {
  characters,
  companionLibrary,
  DIFFICULTY_ORDER,
  type CharacterId,
  type CompanionId,
  type DifficultyId,
} from "@/lib/game-data";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { ALL_LABYRINTH_MODIFIERS } from "@/lib/content-systems/labyrinth/modifiers";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { deduplicateStrings } from "./validation-utils";

function toNonEmptyTuple<T extends string>(values: readonly T[], label: string): [T, ...T[]] {
  if (values.length === 0) throw new Error(`${label} must define at least one value`);
  return values as [T, ...T[]];
}

export const CHARACTER_IDS = toNonEmptyTuple(Object.keys(characters) as CharacterId[], "Character IDs");
const DIFFICULTY_IDS = toNonEmptyTuple(DIFFICULTY_ORDER as readonly DifficultyId[], "Difficulty IDs");
const COMPANION_IDS = toNonEmptyTuple(Object.keys(companionLibrary) as CompanionId[], "Companion IDs");
export const LABYRINTH_MODIFIER_KINDS = toNonEmptyTuple(
  Object.keys(ALL_LABYRINTH_MODIFIERS) as LabyrinthModifierKind[],
  "Labyrinth modifier kinds",
);

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
export const ContentSystemIdSchema = z.enum(["campaign", "labyrinth", "wildwood"]);
export const DamageTypeSchema = z.enum(["physical", "stun", "holy", "burn", "poison", "bleed", "freeze", "nature"]);
export const PlayerStatusIdSchema = z.enum([
  "block",
  "armor",
  "forge",
  "haste",
  "burn",
  "poison",
  "bleed",
  "freeze",
  "stun",
]);
export const EnemyStatusIdSchema = z.enum(["burn", "poison", "bleed", "freeze", "stun"]);
export const CompanionIdSchema = z.enum(COMPANION_IDS);
export const LabyrinthNodeTypeSchema = z.enum([
  "entrance",
  "combat",
  "elite",
  "rest",
  "mystery",
  "shop",
  "alchemist",
  "boss",
]);
export const LabyrinthModifierKindSchema = z.enum(LABYRINTH_MODIFIER_KINDS);
export const LabyrinthNodeStateSchema = z.enum(["hidden", "visible", "current", "cleared", "failed"]);
export const AspectRatioOptionSchema = z.enum(["auto", "16:9", "16:10", "21:9"]);
export const DisplayModeSchema = z.enum(["windowed", "borderless-fullscreen", "fullscreen"]);
export const UiScaleSchema = z.enum(["90", "100", "110", "120"]);

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

export const UnlockedTalentsSchema = recordOfStringArraysSchema();

export const CompletedDifficultiesSchema = recordOfStringArraysSchema(() =>
  Object.fromEntries(CHARACTER_IDS.map((id) => [id, []])),
);

export function createTierRecordSchema<T extends string>(
  items: readonly { id: T; tiers: readonly unknown[] }[],
  renameMap: Record<string, string> = {},
): z.ZodType<Record<T, number>> {
  const validIds = items.map((item) => item.id);
  return z
    .preprocess(
      (val) => {
        if (Array.isArray(val)) {
          const result: Record<string, number> = {};
          for (const rawId of val) {
            const id = typeof rawId === "string" ? (renameMap[rawId] ?? rawId) : String(rawId);
            result[id] = (result[id] ?? 0) + 1;
          }
          return result;
        }
        if (val && typeof val === "object") {
          const result: Record<string, number> = {};
          for (const [rawId, level] of Object.entries(val as Record<string, unknown>)) {
            const id = renameMap[rawId] ?? rawId;
            result[id] = typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
          }
          return result;
        }
        return {};
      },
      z.record(z.string(), z.number().int().nonnegative().catch(0)),
    )
    .transform((data) => {
      const result: Record<string, number> = {};
      for (const id of validIds) {
        const maxTier = items.find((item) => item.id === id)?.tiers.length ?? 0;
        result[id] = Math.min(maxTier, Math.max(0, data[id] ?? 0));
      }
      return result as Record<T, number>;
    });
}
