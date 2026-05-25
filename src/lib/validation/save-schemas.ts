// Zod schemas for all persisted save data fields. This file is the validation layer only;
// migration (version-to-version transforms) lives in migration.ts.
// Depends on: game-data, homestead data, labyrinth modifiers, validation metadata, migration.
// Used by: storage/io.ts (SaveDataSchema.safeParse), storage/migrations.ts (normalizeSaveData wrapper).
import { z } from "zod";
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { isPersistedBattleState } from "@/features/alchemy/storage/active-run";
import {
  characters,
  companionLibrary,
  DIFFICULTY_ORDER,
  getStartingDeck,
  type CharacterId,
  type CompanionId,
  type DifficultyId,
  type BattleCardEffect,
} from "@/lib/game-data";
import type { Screen } from "@/features/alchemy/types";
import { ROUTE_SCREENS } from "@/features/alchemy/types";
import {
  ACTS_PER_RUN,
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
  LEGACY_STARTER_DECK_IDS,
  LEGACY_CHARACTER_RENAMES,
} from "@/lib/game-constants";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { ALL_LABYRINTH_MODIFIERS } from "@/lib/content-systems/labyrinth/modifiers";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_CONTENT_VERSION } from "./metadata";
import { migrateSaveDataToCurrent } from "./migration";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";

// Validation error accumulator — cleared before each parse, readable after.
// Callers (e.g., storage/io.ts) check this after safeParse to detect silent fallbacks.
export type ValidationError = { path: string; message: string };
const _validationErrors: ValidationError[] = [];
export function getAndClearValidationErrors(): ValidationError[] {
  const errors = [..._validationErrors];
  _validationErrors.length = 0;
  return errors;
}

// Wraps schema.catch() to collect and log validation failures instead of swallowing them.
// Returns a preprocess pipeline: tries the inner schema, and on failure logs the error,
// collects it in the global error list, and returns the fallback.
// Returns val (not result.data) on success so the schema downstream does not double-parse.
function caught<T>(schema: z.ZodType<T>, fallback: T, path: string): z.ZodType<T> {
  return z.preprocess((val) => {
    if (val === undefined) return fallback;
    const result = schema.safeParse(val);
    if (!result.success) {
      const error: ValidationError = { path, message: result.error.message };
      _validationErrors.push(error);
      console.error(`[Save Validation] Field "${path}" invalid, fell back to default:`, result.error.message);
      return fallback;
    }
    return result.data;
  }, schema);
}

// Wraps field validation so undefined/missing parses fall back to a safe default
// and log an error.  Other type mismatches are handled by each field's own .catch().
function withFallbackOnUndefined<T>(schema: z.ZodType<T>, fallback: T, fieldName: string): z.ZodType<T> {
  return z.preprocess((val) => {
    if (val === undefined) return fallback;
    const res = schema.safeParse(val);
    if (!res.success) {
      const error: ValidationError = { path: fieldName, message: res.error.message };
      _validationErrors.push(error);
      console.error(`[Save Validation] Field "${fieldName}" invalid, fell back to default:`, res.error.message);
      return fallback;
    }
    return res.data;
  }, schema);
}

// Deduplicates a string array from save data: drops non-strings, deduplicates, defaults to [].
function deduplicatedStringArraySchema(path: string) {
  return caught(
    z.preprocess(
      (val) => (Array.isArray(val) ? [...new Set(val.filter((v) => typeof v === "string"))] : []),
      z.array(z.string()),
    ),
    [],
    path,
  );
}

// Zod enums need a non-empty tuple; this preserves runtime single sources of truth for save IDs.
function toNonEmptyTuple<T extends string>(values: readonly T[], label: string): [T, ...T[]] {
  if (values.length === 0) throw new Error(`${label} must define at least one value`);
  return values as [T, ...T[]];
}

const CHARACTER_IDS = toNonEmptyTuple(Object.keys(characters) as CharacterId[], "Character IDs");
const DIFFICULTY_IDS = toNonEmptyTuple(DIFFICULTY_ORDER as readonly DifficultyId[], "Difficulty IDs");
const COMPANION_IDS = toNonEmptyTuple(Object.keys(companionLibrary) as CompanionId[], "Companion IDs");
const LABYRINTH_MODIFIER_KINDS = toNonEmptyTuple(
  Object.keys(ALL_LABYRINTH_MODIFIERS) as LabyrinthModifierKind[],
  "Labyrinth modifier kinds",
);
// Derived from the live MATERIAL_IDS list so new materials automatically get a zero default.
const MATERIAL_ZERO_INVENTORY = Object.fromEntries(MATERIAL_IDS.map((id) => [id, 0])) as Record<MaterialId, number>;

// Builds a material schema from homestead material IDs so inventory validation follows content changes.
function createMaterialInventoryShape() {
  return MATERIAL_IDS.reduce(
    (shape, id) => ({ ...shape, [id]: z.number().int().nonnegative().catch(0) }),
    {} as Record<MaterialId, z.ZodCatch<z.ZodNumber>>,
  );
}

// ===== String Enums =====
export const CharacterIdSchema = z.enum(CHARACTER_IDS);
export const DifficultyIdSchema = z.enum(DIFFICULTY_IDS);
export const ContentSystemIdSchema = z.enum(["campaign", "labyrinth", "wildwood"]);
export const DamageTypeSchema = z.enum([
  "physical",
  "stun",
  "holy",
  "burn",
  "poison",
  "bleed",
  "freeze",
  "nature",
  "arrow",
]);
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

// ===== Material Inventory =====
export const MaterialInventorySchema = z.object(createMaterialInventoryShape()).catch(MATERIAL_ZERO_INVENTORY);

// ===== Talent / Progression =====
export const TalentXPSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, xp] of Object.entries(val as Record<string, unknown>)) {
    if (typeof xp === "number" && Number.isFinite(xp) && xp >= 0) {
      result[key] = Math.floor(xp);
    }
  }
  return result;
}, z.record(z.string(), z.number().int().nonnegative()).catch({}));

export const UnlockedTalentsSchema = z.preprocess(
  (val) => {
    if (!val || typeof val !== "object") return {};
    const result: Record<string, string[]> = {};
    for (const [key, ids] of Object.entries(val as Record<string, unknown>)) {
      if (Array.isArray(ids)) {
        result[key] = [...new Set(ids.filter((v): v is string => typeof v === "string"))];
      }
    }
    return result;
  },
  z.record(z.string(), z.array(z.string())).catch({}),
);

export const CompletedDifficultiesSchema = z.preprocess(
  (val) => {
    // Seed from CHARACTER_IDS so adding a new character automatically gains an empty slot.
    const result: Record<string, string[]> = Object.fromEntries(CHARACTER_IDS.map((id) => [id, []]));
    if (!val || typeof val !== "object") return result;
    for (const [key, ids] of Object.entries(val as Record<string, unknown>)) {
      if (Array.isArray(ids)) {
        result[key] = [...new Set(ids.filter((v): v is string => typeof v === "string"))];
      } else {
        result[key] = result[key] ?? [];
      }
    }
    return result;
  },
  z.record(z.string(), z.array(z.string())).catch({}),
);

// ===== Tier Record (buildings, farms, research, companions) =====
// Handles legacy string[] and current Record<id, level> formats with ID renames.
function createTierRecordSchema<T extends string>(
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

// ===== BattleCardEffect (13-variant discriminated union) =====
const DamageEffectSchema = z.object({
  kind: z.literal("damage"),
  damageType: DamageTypeSchema,
  amount: z.number().finite(),
  lifesteal: z.boolean().optional(),
  equalToBlock: z.boolean().optional(),
  equalToArmor: z.boolean().optional(),
});

const PlayerStatusEffectSchema = z.object({
  kind: z.literal("player-status"),
  status: z.enum(["block", "armor", "forge", "haste"]),
  amount: z.number().finite(),
});

const HealEffectSchema = z.object({ kind: z.literal("heal"), amount: z.number().finite() });
const RestoreManaEffectSchema = z.object({ kind: z.literal("restore-mana"), amount: z.number().finite() });
const LoseManaEffectSchema = z.object({ kind: z.literal("lose-mana"), amount: z.number().finite() });
const LoseMaxManaEffectSchema = z.object({ kind: z.literal("lose-max-mana"), amount: z.number().finite() });
const GainMaxManaEffectSchema = z.object({ kind: z.literal("gain-max-mana"), amount: z.number().finite() });
const GainGoldEffectSchema = z.object({ kind: z.literal("gain-gold"), amount: z.number().finite() });
const WishEffectSchema = z.object({ kind: z.literal("wish"), amount: z.number().finite() });

const SummonCompanionEffectSchema = z.object({
  kind: z.literal("summon-companion"),
  companionId: CompanionIdSchema,
});

const RemoveHarmfulStatusEffectSchema = z.object({
  kind: z.literal("remove-harmful-status"),
  amount: z.number().finite(),
});

const SelfDamageEffectSchema = z.object({
  kind: z.literal("self-damage"),
  damageType: EnemyStatusIdSchema,
  amount: z.number().finite(),
});

const BuffCompanionEffectSchema = z.object({ kind: z.literal("buff-companion"), amount: z.number().finite() });

export const BattleCardEffectSchema = z.discriminatedUnion("kind", [
  DamageEffectSchema,
  PlayerStatusEffectSchema,
  HealEffectSchema,
  RestoreManaEffectSchema,
  LoseManaEffectSchema,
  LoseMaxManaEffectSchema,
  GainMaxManaEffectSchema,
  GainGoldEffectSchema,
  WishEffectSchema,
  SummonCompanionEffectSchema,
  RemoveHarmfulStatusEffectSchema,
  SelfDamageEffectSchema,
  BuffCompanionEffectSchema,
]);

function parseSavedEffectList(values: unknown[]) {
  const effects = values.flatMap((value, i) => {
    const result = BattleCardEffectSchema.safeParse(value);
    if (!result.success) {
      console.warn(`[Save Validation] Card effect at index ${i} dropped:`, result.error.message);
    }
    return result.success ? [{ ...result.data }] : [];
  });
  return { effects, fullyValid: effects.length === values.length };
}

function cloneSavedDescriptionLines(values: unknown[]): string[] | null {
  return values.every((line) => typeof line === "string") ? [...values] : null;
}

// ===== BattleCard =====
export const BattleCardSchema = z
  .object({
    id: z.string(),
    uid: z.number().int().optional(),
    title: z.string(),
    descriptionLines: z.array(z.unknown()).optional(),
    art: z.string(),
    cost: z.union([z.number(), z.nan()]).catch(-1),
    consume: z.boolean().optional(),
    corrupted: z.boolean().optional(),
    corruptedValuePositions: z
      .array(
        z
          .object({
            lineIndex: z.number().int().nonnegative().catch(0),
            matchIndex: z.number().int().nonnegative().catch(0),
          })
          .nullable()
          .catch(null),
      )
      .optional(),
    baseTitle: z.string().optional(),
    effects: z.array(z.unknown()).optional(),
  })
  .transform((saved) => {
    const savedDescriptionLines = saved.descriptionLines ? cloneSavedDescriptionLines(saved.descriptionLines) : null;
    const savedEffects = saved.effects ? parseSavedEffectList(saved.effects) : { effects: [], fullyValid: false };
    const corruptedValuePositions = Array.isArray(saved.corruptedValuePositions)
      ? saved.corruptedValuePositions.filter(
          (p) =>
            p &&
            typeof p === "object" &&
            Number.isInteger(p.lineIndex) &&
            Number.isInteger(p.matchIndex) &&
            p.lineIndex >= 0 &&
            p.matchIndex >= 0,
        )
      : undefined;
    const cost =
      Number.isFinite(saved.cost) && Number.isInteger(saved.cost) && saved.cost >= 0 ? Math.floor(saved.cost) : -1;
    return {
      id: saved.id,
      uid: saved.uid,
      title: saved.title,
      descriptionLines: savedDescriptionLines ?? [],
      art: saved.art,
      cost,
      consume: saved.consume,
      corrupted: saved.corrupted,
      baseTitle: saved.baseTitle,
      corruptedValuePositions:
        corruptedValuePositions && corruptedValuePositions.length > 0 ? corruptedValuePositions : undefined,
      effects: savedEffects.effects as BattleCardEffect[],
      effectsFullyValid: savedEffects.fullyValid,
      descriptionLinesFullyValid: savedDescriptionLines !== null,
    };
  });

// ===== Labyrinth Node + Map =====
const VALID_LABYRINTH_MODIFIER_KINDS: ReadonlySet<string> = new Set(LABYRINTH_MODIFIER_KINDS);

// Not exported — used only as a Zod preprocess argument within this file.
function filterLabyrinthModifiers(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string" && VALID_LABYRINTH_MODIFIER_KINDS.has(v));
}

const LabyrinthModifierArraySchema = z
  .preprocess(filterLabyrinthModifiers, z.array(LabyrinthModifierKindSchema))
  .catch([]);

export const LabyrinthNodeSchema = z
  .object({
    type: LabyrinthNodeTypeSchema,
    modifiers: LabyrinthModifierArraySchema,
    rewardModifiers: LabyrinthModifierArraySchema,
    connections: z
      .array(
        z.object({
          row: z.number().int().nonnegative().catch(0),
          col: z.number().int().nonnegative().catch(0),
        }),
      )
      .catch([]),
    state: LabyrinthNodeStateSchema,
    enemyId: z.string().optional(),
  })
  .nullable()
  .catch(null);

export const LabyrinthMapSchema = z
  .object({
    grid: z.array(z.array(LabyrinthNodeSchema)),
    rows: z.number().int().nonnegative().catch(0),
    cols: z.number().int().nonnegative().catch(0),
    currentNode: z
      .object({
        row: z.number().int().nonnegative().catch(0),
        col: z.number().int().nonnegative().catch(0),
      })
      .catch({ row: 0, col: 0 }),
  })
  .refine(
    (map) => {
      if (map.rows <= 0 || map.cols <= 0) return false;
      if (map.grid.length !== map.rows) return false;
      if (map.grid.some((row) => row.length !== map.cols)) return false;
      const current = map.grid[map.currentNode.row]?.[map.currentNode.col];
      if (!current) return false;
      let entranceCount = 0;
      let bossCount = 0;
      let currentCount = 0;
      for (let r = 0; r < map.rows; r++) {
        const row = map.grid[r];
        if (!row) return false;
        for (let c = 0; c < map.cols; c++) {
          const node = row[c];
          if (!node) continue;
          if (node.type === "entrance") entranceCount++;
          if (node.type === "boss") bossCount++;
          if (node.state === "current") {
            currentCount++;
            if (map.currentNode.row !== r || map.currentNode.col !== c) return false;
          }
          if (node.connections.length < 1 || node.connections.length > 3) return false;
          for (const conn of node.connections) {
            const target = map.grid[conn.row]?.[conn.col];
            if (!target) return false;
            const dr = Math.abs(conn.row - r);
            const dc = Math.abs(conn.col - c);
            if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return false;
          }
        }
      }
      return entranceCount === 1 && bossCount === 1 && currentCount === 1;
    },
    { message: "Invalid labyrinth map structure" },
  )
  .nullable()
  .catch(null);

const LabyrinthNodePositionSchema = z
  .object({ row: z.number().int().nonnegative(), col: z.number().int().nonnegative() })
  .nullable()
  .catch(null);

export const ActiveCombatDataSchema = z
  .object({
    battleState: z.custom<BattleState>(isPersistedBattleState),
    activeLabyrinthModifiers: LabyrinthModifierArraySchema,
    activeLabyrinthRewardModifiers: LabyrinthModifierArraySchema,
  })
  .transform((data) => ({
    ...data,
    battleState: { ...defaultBattleState(), ...data.battleState } as BattleState,
  }))
  .nullable()
  .catch(null);

// ===== ActiveRunData =====
// Imported from game-constants — single source of truth shared with active-run.ts.

// Pure normalization step extracted from the schema for reuse by normalizeActiveRun and io.ts.
// Returns the full data object with normalized fields spread over the input.
export function normalizeActiveRunData(data: Record<string, unknown>) {
  const labyrinthMap = data.labyrinthMap;
  let contentSystemType = data.contentSystemType as string;
  if (contentSystemType === "labyrinth" && !labyrinthMap) {
    contentSystemType = "campaign";
  }
  const runPlayerHealth = Math.min(data.runPlayerHealth as number, data.runMaxHealth as number);
  const roomsEncountered = typeof data.roomsEncountered === "number" ? data.roomsEncountered : 0;
  const currentAct = typeof data.currentAct === "number" ? data.currentAct : 1;
  const destinationIndexInAct = typeof data.destinationIndexInAct === "number" ? data.destinationIndexInAct : 0;
  const completedDestinations = Array.isArray(data.completedDestinations)
    ? (data.completedDestinations as string[])
    : [];
  const isUnstarted =
    roomsEncountered === 0 && currentAct === 1 && destinationIndexInAct === 0 && completedDestinations.length === 0;
  const runDeckArr = Array.isArray(data.runDeck) ? (data.runDeck as { id: string }[]) : [];
  const legacySet = new Set(LEGACY_STARTER_DECK_IDS);
  const hasLegacyDeck =
    runDeckArr.length === LEGACY_STARTER_DECK_IDS.length &&
    runDeckArr.every((card) => legacySet.has(card.id as (typeof LEGACY_STARTER_DECK_IDS)[number]));
  const characterId = typeof data.characterId === "string" ? (data.characterId as string) : "";
  const runDeck =
    runDeckArr.length === 0 || (isUnstarted && hasLegacyDeck)
      ? characterId
        ? getStartingDeck(characterId as import("@/lib/game-data").CharacterId)
        : []
      : runDeckArr;
  return {
    ...data,
    contentSystemType,
    runPlayerHealth,
    completedDestinations,
    runDeck,
    runTalentXP: (data.runTalentXP as Record<string, number> | undefined) ?? {},
    labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
    activeCombat: data.activeCombat
      ? {
          ...(data.activeCombat as Record<string, unknown>),
          activeLabyrinthModifiers:
            contentSystemType === "labyrinth"
              ? ((data.activeCombat as Record<string, unknown>).activeLabyrinthModifiers ?? [])
              : [],
          activeLabyrinthRewardModifiers:
            contentSystemType === "labyrinth"
              ? ((data.activeCombat as Record<string, unknown>).activeLabyrinthRewardModifiers ?? [])
              : [],
        }
      : null,
  };
}

export const ActiveRunDataSchema = z
  .object({
    characterId: z.preprocess((val) => {
      if (typeof val === "string" && val in LEGACY_CHARACTER_RENAMES) {
        return LEGACY_CHARACTER_RENAMES[val as keyof typeof LEGACY_CHARACTER_RENAMES];
      }
      return val;
    }, CharacterIdSchema),
    runDeck: z.array(BattleCardSchema),
    runGold: caught(z.number().int().nonnegative(), 0, "activeRun.runGold"),
    runPlayerHealth: caught(z.number().int().nonnegative(), 0, "activeRun.runPlayerHealth"),
    runMaxHealth: caught(z.number().int().positive(), 30, "activeRun.runMaxHealth"),
    roomsEncountered: caught(z.number().int().nonnegative(), 0, "activeRun.roomsEncountered"),
    currentAct: caught(z.number().int().min(1).max(ACTS_PER_RUN), 1, "activeRun.currentAct"),
    destinationIndexInAct: caught(z.number().int().nonnegative(), 0, "activeRun.destinationIndexInAct"),
    completedDestinations: caught(z.array(z.string()), [], "activeRun.completedDestinations"),
    runTrinkets: caught(z.array(z.string()), [], "activeRun.runTrinkets"),
    encounteredRunEnemyIds: deduplicatedStringArraySchema("activeRun.encounteredRunEnemyIds").default([]),
    selectedDifficulty: caught(DifficultyIdSchema.nullable(), null, "activeRun.selectedDifficulty").default(null),
    contentSystemType: caught(
      z.preprocess((val) => (val === "wildwood" ? "campaign" : val), ContentSystemIdSchema),
      "campaign",
      "activeRun.contentSystemType",
    ),
    labyrinthMap: caught(LabyrinthMapSchema.nullable(), null, "activeRun.labyrinthMap"),
    labyrinthPendingNode: LabyrinthNodePositionSchema,
    activeCombat: caught(ActiveCombatDataSchema, null, "activeRun.activeCombat").default(null),
    runTalentXP: TalentXPSchema.optional(),
    currentScreen: caught(
      z.enum(Object.values(ROUTE_SCREENS) as [Screen, ...Screen[]]).nullable(),
      null,
      "activeRun.currentScreen",
    ).default(null),
    destinationChoices: caught(z.array(z.string()), [], "activeRun.destinationChoices").default([]),
  })
  .transform((data) => normalizeActiveRunData(data as Record<string, unknown>) as typeof data)
  .refine((data) => data.contentSystemType !== "labyrinth" || data.labyrinthMap !== null, {
    message: "Labyrinth runs require a valid labyrinth map",
  });

// ===== SaveData =====
export const SaveDataSchema = z.preprocess(
  (raw) => migrateSaveDataToCurrent(raw),
  z.object({
    saveSchemaVersion: caught(z.literal(CURRENT_SAVE_SCHEMA_VERSION), CURRENT_SAVE_SCHEMA_VERSION, "saveSchemaVersion"),
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
    activeRun: withFallbackOnUndefined(ActiveRunDataSchema.nullable(), null, "activeRun"),
    materialInventory: withFallbackOnUndefined(MaterialInventorySchema, MATERIAL_ZERO_INVENTORY, "materialInventory"),
    constructedBuildings: withFallbackOnUndefined(
      createTierRecordSchema(buildings, { smithy: "blacksmiths-forge" }),
      createEmptyTierRecord(buildings),
      "constructedBuildings",
    ),
    plantedFarms: withFallbackOnUndefined(
      createTierRecordSchema(farmPlots, { "sheep-pasture": "pasture" }),
      createEmptyTierRecord(farmPlots),
      "plantedFarms",
    ),
    completedResearch: withFallbackOnUndefined(
      createTierRecordSchema(researchUpgrades),
      createEmptyTierRecord(researchUpgrades),
      "completedResearch",
    ),
    bondedCompanions: withFallbackOnUndefined(
      createTierRecordSchema(companionTierItems),
      createEmptyTierRecord(companionTierItems),
      "bondedCompanions",
    ),
    completedDifficulties: withFallbackOnUndefined(
      CompletedDifficultiesSchema,
      Object.fromEntries(CHARACTER_IDS.map((id) => [id, []])),
      "completedDifficulties",
    ),
  }),
);
