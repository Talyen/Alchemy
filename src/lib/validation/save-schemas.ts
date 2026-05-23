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

function catchWithWarning<T>(schema: z.ZodType<T>, fallback: T, fieldName: string): z.ZodType<T> {
  return z.preprocess((val) => {
    if (val === undefined) return fallback;
    const res = schema.safeParse(val);
    if (!res.success) {
      console.warn(`[Save Validation] Field "${fieldName}" fallback to default due to error:`, res.error.message);
      return fallback;
    }
    return res.data;
  }, z.any()) as z.ZodType<T>;
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
  "trap",
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
  const effects = values.flatMap((value) => {
    const result = BattleCardEffectSchema.safeParse(value);
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

export const LabyrinthNodeSchema = z
  .object({
    type: LabyrinthNodeTypeSchema,
    modifiers: z.preprocess(filterLabyrinthModifiers, z.array(LabyrinthModifierKindSchema)).catch([]),
    rewardModifiers: z.preprocess(filterLabyrinthModifiers, z.array(LabyrinthModifierKindSchema)).catch([]),
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
    activeLabyrinthModifiers: z.preprocess(filterLabyrinthModifiers, z.array(LabyrinthModifierKindSchema)).catch([]),
    activeLabyrinthRewardModifiers: z
      .preprocess(filterLabyrinthModifiers, z.array(LabyrinthModifierKindSchema))
      .catch([]),
  })
  .transform((data) => ({
    ...data,
    battleState: { ...defaultBattleState(), ...data.battleState } as BattleState,
  }))
  .nullable()
  .catch(null);

// ===== ActiveRunData =====
// Imported from game-constants — single source of truth shared with active-run.ts.

export const ActiveRunDataSchema = z
  .object({
    characterId: z.preprocess((val) => {
      if (typeof val === "string" && val in LEGACY_CHARACTER_RENAMES) {
        return LEGACY_CHARACTER_RENAMES[val as keyof typeof LEGACY_CHARACTER_RENAMES];
      }
      return val;
    }, CharacterIdSchema),
    runDeck: z.array(BattleCardSchema),
    runGold: z.number().int().nonnegative().catch(0),
    runPlayerHealth: z.number().int().nonnegative().catch(0),
    runMaxHealth: z.number().int().positive().catch(30),
    roomsEncountered: z.number().int().nonnegative().catch(0),
    currentAct: z.number().int().min(1).max(ACTS_PER_RUN).catch(1),
    destinationIndexInAct: z.number().int().nonnegative().catch(0),
    completedDestinations: z.array(z.string()).catch([]),
    runTrinkets: z.array(z.string()).catch([]),
    encounteredRunEnemyIds: z
      .preprocess(
        (val) => (Array.isArray(val) ? [...new Set(val.filter((v) => typeof v === "string"))] : []),
        z.array(z.string()),
      )
      .catch([])
      .default([]),
    selectedDifficulty: DifficultyIdSchema.nullable().catch(null).default(null),
    contentSystemType: z
      .preprocess((val) => (val === "wildwood" ? "campaign" : val), ContentSystemIdSchema)
      .default("campaign")
      .catch("campaign"),
    labyrinthMap: LabyrinthMapSchema.nullable().catch(null),
    labyrinthPendingNode: LabyrinthNodePositionSchema,
    activeCombat: ActiveCombatDataSchema.default(null),
  })
  .transform((data) => {
    let contentSystemType = data.contentSystemType;
    if (contentSystemType === "labyrinth" && data.labyrinthMap === null) {
      contentSystemType = "campaign";
    }
    const runPlayerHealth = Math.min(data.runPlayerHealth, data.runMaxHealth);
    const isUnstarted =
      data.roomsEncountered === 0 &&
      data.currentAct === 1 &&
      data.destinationIndexInAct === 0 &&
      data.completedDestinations.length === 0;
    const hasLegacyDeck =
      data.runDeck.length === LEGACY_STARTER_DECK_IDS.length &&
      data.runDeck.every((card, i) => card.id === (LEGACY_STARTER_DECK_IDS as readonly string[])[i]);
    const runDeck =
      data.runDeck.length === 0 || (isUnstarted && hasLegacyDeck) ? getStartingDeck(data.characterId) : data.runDeck;
    return {
      ...data,
      runDeck,
      contentSystemType,
      runPlayerHealth,
      labyrinthMap: contentSystemType === "labyrinth" ? data.labyrinthMap : null,
      labyrinthPendingNode: contentSystemType === "labyrinth" ? data.labyrinthPendingNode : null,
      activeCombat: data.activeCombat
        ? {
            ...data.activeCombat,
            activeLabyrinthModifiers:
              contentSystemType === "labyrinth" ? data.activeCombat.activeLabyrinthModifiers : [],
            activeLabyrinthRewardModifiers:
              contentSystemType === "labyrinth" ? data.activeCombat.activeLabyrinthRewardModifiers : [],
          }
        : null,
    };
  })
  .refine((data) => data.contentSystemType !== "labyrinth" || data.labyrinthMap !== null, {
    message: "Labyrinth runs require a valid labyrinth map",
  });

// ===== SaveData =====
export const SaveDataSchema = z.preprocess(
  (raw) => migrateSaveDataToCurrent(raw),
  z.object({
    saveSchemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION).catch(CURRENT_SAVE_SCHEMA_VERSION),
    gameBuildVersion: z.string().catch(CURRENT_GAME_BUILD_VERSION),
    contentVersion: z.number().int().nonnegative().catch(CURRENT_CONTENT_VERSION),
    selectedAspectRatio: AspectRatioOptionSchema.catch("auto"),
    displayMode: DisplayModeSchema.catch("borderless-fullscreen"),
    uiScale: UiScaleSchema.catch("100"),
    brightness: z
      .number()
      .finite()
      .catch(DEFAULT_BRIGHTNESS_PCT)
      .transform((v) => Math.max(50, Math.min(150, v))),
    discoveredCardIds: z
      .preprocess(
        (val) => (Array.isArray(val) ? [...new Set(val.filter((v) => typeof v === "string"))] : []),
        z.array(z.string()),
      )
      .catch([]),
    encounteredEnemyIds: z
      .preprocess(
        (val) => (Array.isArray(val) ? [...new Set(val.filter((v) => typeof v === "string"))] : []),
        z.array(z.string()),
      )
      .catch([]),
    discoveredTrinketIds: z
      .preprocess(
        (val) => (Array.isArray(val) ? [...new Set(val.filter((v) => typeof v === "string"))] : []),
        z.array(z.string()),
      )
      .catch([]),
    talentXP: TalentXPSchema,
    unlockedTalents: UnlockedTalentsSchema,
    // .catch() fallbacks must match defaults.ts — both come from game-constants.ts.
    musicVolume: z
      .number()
      .finite()
      .catch(DEFAULT_MUSIC_VOLUME_PCT)
      .transform((v) => Math.max(0, Math.min(100, v))),
    sfxVolume: z
      .number()
      .finite()
      .catch(DEFAULT_SFX_VOLUME_PCT)
      .transform((v) => Math.max(0, Math.min(100, v))),
    masterVolume: z
      .number()
      .finite()
      .catch(DEFAULT_MASTER_VOLUME_PCT)
      .transform((v) => Math.max(0, Math.min(100, v))),
    muteInBackground: z.boolean().catch(true),
    autoEndTurn: z.boolean().catch(true),
    activeRun: catchWithWarning(ActiveRunDataSchema.nullable(), null, "activeRun"),
    materialInventory: catchWithWarning(MaterialInventorySchema, MATERIAL_ZERO_INVENTORY, "materialInventory"),
    constructedBuildings: catchWithWarning(
      createTierRecordSchema(buildings, { smithy: "blacksmiths-forge" }),
      createEmptyTierRecord(buildings),
      "constructedBuildings",
    ),
    plantedFarms: catchWithWarning(
      createTierRecordSchema(farmPlots, { "sheep-pasture": "pasture" }),
      createEmptyTierRecord(farmPlots),
      "plantedFarms",
    ),
    completedResearch: catchWithWarning(
      createTierRecordSchema(researchUpgrades),
      createEmptyTierRecord(researchUpgrades),
      "completedResearch",
    ),
    bondedCompanions: catchWithWarning(
      createTierRecordSchema(companionTierItems),
      createEmptyTierRecord(companionTierItems),
      "bondedCompanions",
    ),
    completedDifficulties: catchWithWarning(
      CompletedDifficultiesSchema,
      Object.fromEntries(CHARACTER_IDS.map((id) => [id, []])),
      "completedDifficulties",
    ),
  }),
);
