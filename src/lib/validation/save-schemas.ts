import { z } from "zod";
import { cardLibrary, getStartingDeck } from "@/lib/game-data";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { CURRENT_SAVE_SCHEMA_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_CONTENT_VERSION } from "./metadata";
import { migrateSaveDataToCurrent } from "./migration";

// ===== String Enums =====
export const CharacterIdSchema = z.enum(["knight", "ranger", "rogue", "wizard"]);
export const DifficultyIdSchema = z.enum(["difficulty-1", "difficulty-2", "difficulty-3"]);
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
export const CompanionIdSchema = z.enum(["wolf", "lizard-scout", "imp", "frost-whelp", "bear", "panther", "phoenix"]);
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
export const LabyrinthModifierKindSchema = z.enum([
  "armored",
  "sturdy",
  "burning-ground",
  "overwhelming",
  "leeching",
  "null-field",
  "collector",
  "generous",
  "alchemist",
  "scavenger",
  "companion",
]);
export const LabyrinthNodeStateSchema = z.enum(["hidden", "visible", "current", "cleared", "failed"]);
export const AspectRatioOptionSchema = z.enum(["auto", "16:9", "16:10", "21:9"]);
export const DisplayModeSchema = z.enum(["windowed", "borderless-fullscreen", "fullscreen"]);
export const UiScaleSchema = z.enum(["90", "100", "110", "120"]);

// ===== Material Inventory =====
const MATERIAL_IDS = ["wood", "iron", "herbs", "food", "crystal"] as const;
export const MaterialInventorySchema = z
  .object(
    Object.fromEntries(MATERIAL_IDS.map((id) => [id, z.number().int().nonnegative().catch(0)])) as unknown as Record<
      (typeof MATERIAL_IDS)[number],
      z.ZodNumber
    >,
  )
  .catch({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });

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
    const result: Record<string, string[]> = { knight: [], rogue: [], wizard: [], ranger: [] };
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneSavedObjectList(values: unknown[]): Record<string, unknown>[] {
  return values.filter(isObjectRecord).map((value) => ({ ...value }));
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
    descriptionLines: z.array(z.unknown()).catch([]),
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
    effects: z.array(z.unknown()).catch([]),
  })
  .transform((saved) => {
    const libraryCard = cardLibrary.find((c) => c.id === saved.id);
    const savedDescriptionLines = cloneSavedDescriptionLines(saved.descriptionLines);
    const savedEffects = cloneSavedObjectList(saved.effects);
    if (!libraryCard) return { ...saved, descriptionLines: savedDescriptionLines ?? [], effects: savedEffects };
    const descriptionLines: string[] = savedDescriptionLines ?? [...libraryCard.descriptionLines];
    const effects = savedEffects.length > 0 ? savedEffects : libraryCard.effects.map((e) => ({ ...e }));
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
      Number.isFinite(saved.cost) && Number.isInteger(saved.cost) && saved.cost >= 0
        ? Math.floor(saved.cost)
        : libraryCard.cost;
    return {
      ...libraryCard,
      descriptionLines,
      effects,
      uid: saved.uid,
      cost,
      consume: saved.consume,
      corrupted: saved.corrupted,
      baseTitle: saved.baseTitle,
      corruptedValuePositions:
        corruptedValuePositions && corruptedValuePositions.length > 0 ? corruptedValuePositions : undefined,
    };
  });

// ===== Labyrinth Node + Map =====
const VALID_LABYRINTH_MODIFIER_KINDS = new Set([
  "armored",
  "sturdy",
  "burning-ground",
  "overwhelming",
  "leeching",
  "null-field",
  "collector",
  "generous",
  "alchemist",
  "scavenger",
  "companion",
]);

export function filterLabyrinthModifiers(val: unknown): string[] {
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

// ===== ActiveRunData =====
const LEGACY_STARTER_DECK_IDS = ["slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis"];

export const ActiveRunDataSchema = z
  .object({
    characterId: z.preprocess((val) => {
      if (typeof val === "string" && val === "sorcerer") return "wizard";
      if (typeof val === "string" && val === "warden") return "ranger";
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
    selectedDifficulty: DifficultyIdSchema.nullable().catch(null).default(null),
    contentSystemType: z
      .preprocess((val) => (val === "wildwood" ? "campaign" : val), ContentSystemIdSchema)
      .default("campaign")
      .catch("campaign"),
    labyrinthMap: LabyrinthMapSchema.nullable().catch(null),
  })
  .refine(
    (data) => {
      if (data.runPlayerHealth > data.runMaxHealth) return false;
      return true;
    },
    { message: "Player health exceeds max health" },
  )
  .transform((data) => {
    const isUnstarted =
      data.roomsEncountered === 0 &&
      data.currentAct === 1 &&
      data.destinationIndexInAct === 0 &&
      data.completedDestinations.length === 0;
    const hasLegacyDeck =
      data.runDeck.length === LEGACY_STARTER_DECK_IDS.length &&
      data.runDeck.every((card, i) => card.id === LEGACY_STARTER_DECK_IDS[i]);
    const runDeck =
      data.runDeck.length === 0 || (isUnstarted && hasLegacyDeck) ? getStartingDeck(data.characterId) : data.runDeck;
    return {
      ...data,
      runDeck,
      labyrinthMap: data.contentSystemType === "labyrinth" ? data.labyrinthMap : null,
    };
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
      .catch(100)
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
    musicVolume: z
      .number()
      .finite()
      .catch(35)
      .transform((v) => Math.max(0, Math.min(100, v))),
    sfxVolume: z
      .number()
      .finite()
      .catch(70)
      .transform((v) => Math.max(0, Math.min(100, v))),
    masterVolume: z
      .number()
      .finite()
      .catch(100)
      .transform((v) => Math.max(0, Math.min(100, v))),
    muteInBackground: z.boolean().catch(true),
    autoEndTurn: z.boolean().catch(true),
    activeRun: ActiveRunDataSchema.nullable().catch(null),
    materialInventory: MaterialInventorySchema,
    constructedBuildings: createTierRecordSchema(buildings, { smithy: "blacksmiths-forge" }),
    plantedFarms: createTierRecordSchema(farmPlots, { "sheep-pasture": "pasture" }),
    completedResearch: createTierRecordSchema(researchUpgrades),
    bondedCompanions: createTierRecordSchema(companionTierItems),
    completedDifficulties: CompletedDifficultiesSchema,
  }),
);
