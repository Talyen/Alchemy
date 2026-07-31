// Active run and mid-combat persistence schemas.
import { z } from "zod";
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { computeTrinketManifest, isDefaultTrinketManifest } from "@/lib/trinkets";
import { isPersistedBattleState } from "../battle-state-guard";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing";
import { ACTS_PER_RUN, LEGACY_CHARACTER_RENAMES } from "@/lib/game-constants";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { sanitizeEncounterTraitIds, sanitizePersistedEnemyTraits } from "@/lib/content-systems/encounter-traits";
import { normalizeActiveRunData } from "../normalize-active-run-data";
import { GearInstanceArraySchema, GearInstanceSchema, normalizeGearInstanceArray } from "./gear-schemas";
import { emptyInventory } from "@/lib/homestead/inventory";
import {
  caught,
  deduplicatedStringArraySchema,
  CharacterIdSchema,
  ContentSystemIdSchema,
  DifficultyIdSchema,
  TalentXPSchema,
  BattleCardSchema,
  LabyrinthMapSchema,
  EncounterCombatTraitArraySchema,
  EncounterRewardTraitArraySchema,
  MaterialInventorySchema,
} from "./core";
import { createRunRngState } from "@/lib/run-rng";

const RunRngStateSchema = z.object({
  seed: z.number().int().nonnegative().max(0xffff_ffff),
  counters: z.object({
    rewards: z.number().int().nonnegative().catch(0).default(0),
    destinations: z.number().int().nonnegative().catch(0).default(0),
    events: z.number().int().nonnegative().catch(0).default(0),
    shops: z.number().int().nonnegative().catch(0).default(0),
    world: z.number().int().nonnegative().catch(0).default(0),
  }),
});

const LabyrinthNodePositionSchema = z
  .object({ row: z.number().int().nonnegative(), col: z.number().int().nonnegative() })
  .nullable()
  .catch(null);

const ActiveCombatDataSchema = z
  .object({
    battleState: z.custom<BattleState>(isPersistedBattleState),
    activeLabyrinthModifiers: EncounterCombatTraitArraySchema,
    activeLabyrinthRewardModifiers: EncounterRewardTraitArraySchema,
  })
  .transform((data) => {
    const defaults = defaultBattleState();
    const saved = data.battleState;
    return {
      ...data,
      battleState: {
        ...defaults,
        ...saved,
        trinketEffects: { ...defaults.trinketEffects, ...saved.trinketEffects },
        gearEffects: { ...defaults.gearEffects, ...saved.gearEffects },
        flags: { ...defaults.flags, ...saved.flags },
        currentEnemy: {
          ...saved.currentEnemy,
          traits: sanitizePersistedEnemyTraits(
            Array.isArray(saved.currentEnemy.traits) ? saved.currentEnemy.traits : [],
          ),
        },
      },
    };
  })
  .nullable()
  .catch(null);

const WildwoodBossIdSchema = z.enum(WILDWOOD_BOSS_IDS);

const ShopPersistSchema = z
  .object({
    cards: z.array(BattleCardSchema),
    removeUsed: caught(z.boolean(), false, "activeRun.shopState.removeUsed"),
    refreshesLeft: caught(z.number().int().nonnegative(), 0, "activeRun.shopState.refreshesLeft"),
    firstPurchaseUsed: caught(z.boolean(), false, "activeRun.shopState.firstPurchaseUsed"),
    purchasedSlotKeys: deduplicatedStringArraySchema("activeRun.shopState.purchasedSlotKeys").default([]),
  })
  .nullable()
  .catch(null);

const AlchemistPersistSchema = z
  .object({
    potions: z.array(BattleCardSchema),
    mixUsed: caught(z.boolean(), false, "activeRun.alchemistState.mixUsed"),
    refreshesLeft: caught(z.number().int().nonnegative(), 0, "activeRun.alchemistState.refreshesLeft"),
    firstPurchaseUsed: caught(z.boolean(), false, "activeRun.alchemistState.firstPurchaseUsed"),
    purchasedSlotKeys: deduplicatedStringArraySchema("activeRun.alchemistState.purchasedSlotKeys").default([]),
  })
  .nullable()
  .catch(null);

const TrinketShopPersistSchema = z
  .object({
    trinketIds: z.array(z.string()),
    refreshesLeft: caught(z.number().int().nonnegative(), 0, "activeRun.trinketShopState.refreshesLeft"),
    firstPurchaseUsed: caught(z.boolean(), false, "activeRun.trinketShopState.firstPurchaseUsed"),
    purchasedSlotKeys: deduplicatedStringArraySchema("activeRun.trinketShopState.purchasedSlotKeys").default([]),
  })
  .nullable()
  .catch(null);

const EquipmentShopPersistSchema = z
  .object({
    gear: GearInstanceArraySchema,
    refreshesLeft: caught(z.number().int().nonnegative(), 0, "activeRun.equipmentShopState.refreshesLeft"),
    firstPurchaseUsed: caught(z.boolean(), false, "activeRun.equipmentShopState.firstPurchaseUsed"),
    purchasedSlotKeys: deduplicatedStringArraySchema("activeRun.equipmentShopState.purchasedSlotKeys").default([]),
  })
  .nullable()
  .catch(null);

const WildwoodDraftStateSchema = z
  .preprocess(
    (raw) => {
      if (!raw || typeof raw !== "object") return raw;
      const state = raw as Record<string, unknown>;
      const next: Record<string, unknown> = { ...state };
      if (state.version === 2) {
        next.version = 3;
        if (!("rewardGearChoices" in state)) {
          next.rewardGearChoices = [];
        }
      }
      if (state.rewardType === "boon") {
        next.rewardType = "trinket";
      }
      return next;
    },
    z.object({
      version: z.literal(3),
      phase: z.enum(["draft", "battle", "recovery", "reward", "removal"]),
      draftChoices: z.array(BattleCardSchema),
      remainingBossIds: z.array(WildwoodBossIdSchema),
      previousBossId: WildwoodBossIdSchema.nullable(),
      currentBossId: WildwoodBossIdSchema.nullable(),
      currentCombatTraitIds: z.array(z.string()).default([]),
      currentRewardTraitIds: z.array(z.string()).default([]),
      rewardType: z.enum(["card", "trinket", "gear"]).nullable(),
      rewardChoiceIds: z.array(z.string()),
      rewardGearChoices: GearInstanceArraySchema,
      selectedRewardId: z.string().nullable(),
    }),
  )
  .transform((state) => ({
    ...state,
    currentCombatTraitIds: sanitizeEncounterTraitIds(state.currentCombatTraitIds, "combat"),
    currentRewardTraitIds: sanitizeEncounterTraitIds(state.currentRewardTraitIds, "reward"),
  }))
  .nullable()
  .catch(null);

const PersistedPendingRewardBaseSchema = {
  // Companion choices are carried separately from the primary reward choice so
  // a save during the victory -> companion-reward handoff can resume safely.
  companionChoiceIds: z.array(z.string()).default([]),
  selectedId: caught(z.string().nullable(), null, "activeRun.pendingReward.selectedId"),
  gold: caught(z.number().int().nonnegative(), 0, "activeRun.pendingReward.gold"),
  materials: caught(MaterialInventorySchema, emptyInventory(), "activeRun.pendingReward.materials"),
  destinations: caught(z.array(z.string()), [], "activeRun.pendingReward.destinations"),
  selectedBossId: caught(z.string().nullable(), null, "activeRun.pendingReward.selectedBossId"),
  lastVictoryEnemyType: caught(z.string().nullable(), null, "activeRun.pendingReward.lastVictoryEnemyType"),
  lastVictoryContentSystem: caught(
    ContentSystemIdSchema.nullable(),
    null,
    "activeRun.pendingReward.lastVictoryContentSystem",
  ),
};

const PersistedPendingRewardUnionSchema = z.discriminatedUnion("rewardType", [
  z.object({
    rewardType: z.literal("card"),
    choiceIds: z.array(z.string()),
    ...PersistedPendingRewardBaseSchema,
  }),
  z.object({
    rewardType: z.literal("trinket"),
    choiceIds: z.array(z.string()),
    ...PersistedPendingRewardBaseSchema,
  }),
  z.object({
    rewardType: z.literal("gear"),
    gearChoices: z.preprocess((raw) => normalizeGearInstanceArray(raw), z.array(GearInstanceSchema).min(1)),
    ...PersistedPendingRewardBaseSchema,
  }),
]);

const PersistedPendingRewardSchema = z
  .preprocess((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const item = raw as Record<string, unknown>;
    if (item.rewardType === "boon") return { ...item, rewardType: "trinket" };
    return raw;
  }, PersistedPendingRewardUnionSchema)
  .nullable()
  .catch(null);

// The parser always supplies companionChoiceIds, while callers restoring older
// in-memory fixtures may still omit it.
type OptionalCompanionChoiceIds<T> = T extends unknown
  ? Omit<T, "companionChoiceIds"> & { companionChoiceIds?: string[] }
  : never;
export type PersistedPendingReward = OptionalCompanionChoiceIds<z.infer<typeof PersistedPendingRewardUnionSchema>>;

// ===== ActiveRunData =====
// normalizeActiveRunData lives in ./normalize-active-run-data.ts — imported above.

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
    lastOfferedDestinations: caught(z.array(z.string()), [], "activeRun.lastOfferedDestinations").default([]),
    destinationRoundsSinceOffered: caught(
      z.record(z.string(), z.number().int().nonnegative()),
      {},
      "activeRun.destinationRoundsSinceOffered",
    ).default({}),
    runTrinkets: caught(z.array(z.string()), [], "activeRun.runTrinkets"),
    encounteredRunEnemyIds: deduplicatedStringArraySchema("activeRun.encounteredRunEnemyIds").default([]),
    selectedDifficulty: caught(DifficultyIdSchema.nullable(), null, "activeRun.selectedDifficulty").default(null),
    contentSystemType: caught(ContentSystemIdSchema, "campaign", "activeRun.contentSystemType"),
    rng: RunRngStateSchema.default(() => createRunRngState()),
    labyrinthMap: caught(LabyrinthMapSchema.nullable(), null, "activeRun.labyrinthMap"),
    labyrinthPendingNode: LabyrinthNodePositionSchema,
    wildwoodDraft: WildwoodDraftStateSchema.default(null),
    activeCombat: caught(ActiveCombatDataSchema, null, "activeRun.activeCombat").default(null),
    // Defaults match normalizeActiveRunData — required on Zod output without a post-cast.
    runTalentXP: TalentXPSchema.default({}),
    runMaterialsEarned: MaterialInventorySchema.default(emptyInventory()),
    currentScreen: caught(z.enum(ROUTE_SCREEN_VALUES).nullable(), null, "activeRun.currentScreen").default(null),
    destinationChoices: caught(z.array(z.string()), [], "activeRun.destinationChoices").default([]),
    pendingReward: caught(PersistedPendingRewardSchema, null, "activeRun.pendingReward").default(null),
    shopState: ShopPersistSchema.default(null),
    alchemistState: AlchemistPersistSchema.default(null),
    trinketShopState: TrinketShopPersistSchema.default(null),
    equipmentShopState: EquipmentShopPersistSchema.default(null),
  })
  .transform((data) => normalizeActiveRunData(data))
  .transform((data) => {
    if (!data.activeCombat?.battleState || data.runTrinkets.length === 0) return data;
    const battleState = data.activeCombat.battleState;
    if (!isDefaultTrinketManifest(battleState.trinketEffects)) return data;
    return {
      ...data,
      activeCombat: {
        ...data.activeCombat,
        battleState: {
          ...battleState,
          trinketEffects: computeTrinketManifest(data.runTrinkets),
        },
      },
    };
  })
  .refine((data) => data.contentSystemType !== "labyrinth" || data.labyrinthMap !== null, {
    message: "Labyrinth runs require a valid labyrinth map",
  })
  .refine((data) => data.contentSystemType !== "wildwood" || data.wildwoodDraft !== null, {
    message: "Wildwood Draft runs require versioned mode state",
  });

export type ParsedActiveRunData = z.output<typeof ActiveRunDataSchema>;
