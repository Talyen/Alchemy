// Active run and mid-combat persistence schemas.
import { z } from "zod";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { sanitizeEncounterTraitIds } from "@/lib/content-systems/encounter-traits";
import { normalizeActiveRunData } from "../normalize-active-run-data";
import { GearInstanceArraySchema, GearInstanceSchema, normalizeGearInstanceArray } from "./gear-schemas";
import { PersistedBattleStateSchema } from "./persisted-battle-state";
import { emptyInventory } from "@/lib/homestead/inventory";
import {
  deduplicatedStringArraySchema,
  CharacterIdSchema,
  ContentSystemIdSchema,
  DifficultyIdSchema,
  DestinationArraySchema,
  TalentXPSchema,
  BattleCardSchema,
  LabyrinthMapSchema,
  EncounterCombatTraitArraySchema,
  EncounterRewardTraitArraySchema,
  MaterialInventorySchema,
} from "./core";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";
import { createRunRngState } from "@/lib/run-rng";

const MaterialIdPersistSchema = z.enum(MATERIAL_IDS as [MaterialId, ...MaterialId[]]);

const MysteryEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("addCard"), cardId: z.string() }),
  z.object({ kind: z.literal("chooseCard"), tag: z.string().optional() }),
  z.object({ kind: z.literal("healHealth"), amount: z.number(), chance: z.number().optional() }),
  z.object({ kind: z.literal("damageHealth"), amount: z.number() }),
  z.object({ kind: z.literal("gainGold"), amount: z.number() }),
  z.object({ kind: z.literal("loseGold"), amount: z.number() }),
  z.object({ kind: z.literal("gainXP"), keyword: z.string(), amount: z.number() }),
  z.object({ kind: z.literal("removeCard") }),
  z.object({ kind: z.literal("gainTrinket"), trinketId: z.string() }),
  z.object({ kind: z.literal("gainRandomTrinket"), fromIds: z.array(z.string()).optional() }),
  z.object({ kind: z.literal("gainGeneratedGear"), baseItemId: z.string() }),
  z.object({ kind: z.literal("gainMaterial"), material: MaterialIdPersistSchema, amount: z.number() }),
]);

const MysteryChoicePersistSchema = z.object({
  label: z.string(),
  effects: z.array(MysteryEffectSchema),
});

const MysteryVisitPersistSchema = z
  .object({
    eventId: z.string(),
    chosenChoice: MysteryChoicePersistSchema.nullable().catch(null).default(null),
    pendingRemoval: z.boolean().catch(false).default(false),
    cardChoices: z.array(BattleCardSchema).nullable().catch(null).default(null),
    grantedTrinketIds: z.array(z.string()).catch([]).default([]),
    grantedGear: GearInstanceArraySchema.catch([]).default([]),
    chosenCardId: z.string().nullable().catch(null).default(null),
    resolvedTrinketIds: z.array(z.string()).catch([]).default([]),
  })
  .nullable()
  .catch(null)
  .default(null);

const CorruptionResultPersistSchema = z
  .object({
    originalCard: BattleCardSchema,
    corruptedCard: BattleCardSchema,
    transformed: z.boolean(),
    delta: z.union([z.literal(1), z.literal(-1)]),
  })
  .nullable()
  .catch(null)
  .default(null);

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

const PersistedBattleTransitionSchema = z
  .union([
    z.object({
      kind: z.literal("enemy-turn"),
      resultState: PersistedBattleStateSchema,
      playerTurnSkipped: z.boolean(),
    }),
    z.object({ kind: z.literal("continue-end-turn") }),
    // Accepted on load so enemy-phase snapshots without a continuation can resume.
    z.object({ kind: z.literal("legacy-enemy-turn") }),
  ])
  .nullable()
  .catch(null)
  .default(null);

const ActiveCombatDataSchema = z
  .object({
    battleState: PersistedBattleStateSchema,
    pendingBattleTransition: PersistedBattleTransitionSchema,
    activeLabyrinthModifiers: EncounterCombatTraitArraySchema,
    activeLabyrinthRewardModifiers: EncounterRewardTraitArraySchema,
  })
  .nullable()
  .catch(null);

const WildwoodBossIdSchema = z.enum(WILDWOOD_BOSS_IDS);

const ShopPersistSchema = z
  .object({
    cards: z.array(BattleCardSchema),
    removeUsed: z.boolean().catch(false),
    refreshesLeft: z.number().int().nonnegative().catch(0),
    firstPurchaseUsed: z.boolean().catch(false),
    purchasedSlotKeys: deduplicatedStringArraySchema().default([]),
  })
  .nullable()
  .catch(null);

const AlchemistPersistSchema = z
  .object({
    potions: z.array(BattleCardSchema),
    mixUsed: z.boolean().catch(false),
    refreshesLeft: z.number().int().nonnegative().catch(0),
    firstPurchaseUsed: z.boolean().catch(false),
    purchasedSlotKeys: deduplicatedStringArraySchema().default([]),
  })
  .nullable()
  .catch(null);

const TrinketShopPersistSchema = z
  .object({
    trinketIds: z.array(z.string()),
    refreshesLeft: z.number().int().nonnegative().catch(0),
    firstPurchaseUsed: z.boolean().catch(false),
    purchasedSlotKeys: deduplicatedStringArraySchema().default([]),
  })
  .nullable()
  .catch(null);

const EquipmentShopPersistSchema = z
  .object({
    gear: GearInstanceArraySchema,
    refreshesLeft: z.number().int().nonnegative().catch(0),
    firstPurchaseUsed: z.boolean().catch(false),
    purchasedSlotKeys: deduplicatedStringArraySchema().default([]),
  })
  .nullable()
  .catch(null);

const WildwoodDraftStateSchema = z
  .object({
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
    rewardGearChoices: GearInstanceArraySchema.default([]),
    selectedRewardId: z.string().nullable(),
  })
  .transform((state) => ({
    ...state,
    phase: state.phase === "recovery" ? ("reward" as const) : state.phase,
    currentCombatTraitIds: sanitizeEncounterTraitIds(state.currentCombatTraitIds, "combat"),
    currentRewardTraitIds: sanitizeEncounterTraitIds(state.currentRewardTraitIds, "reward"),
  }))
  .nullable()
  .catch(null);

const PersistedPendingRewardBaseSchema = {
  // Companion choices are carried separately from the primary reward choice so
  // a save during the victory -> companion-reward handoff can resume safely.
  companionChoiceIds: z.array(z.string()).default([]),
  selectedId: z.string().nullable().catch(null),
  gold: z.number().int().nonnegative().catch(0),
  materials: MaterialInventorySchema.catch(emptyInventory()),
  destinations: DestinationArraySchema,
  selectedBossId: z.string().nullable().catch(null),
  lastVictoryEnemyType: z.string().nullable().catch(null),
  lastVictoryContentSystem: ContentSystemIdSchema.nullable().catch(null),
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

export type PersistedPendingReward = z.infer<typeof PersistedPendingRewardUnionSchema>;

const InterruptedFlowDestinationSchema = z.object({
  kind: z.literal("destination"),
  destinations: DestinationArraySchema,
  selectedBossId: z.string().nullable().catch(null),
  lastVictoryEnemyType: z.string().nullable().catch(null),
  lastVictoryContentSystem: ContentSystemIdSchema.nullable().catch(null),
});

const InterruptedFlowSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("primary-reward"), pending: PersistedPendingRewardUnionSchema }),
    z.object({ kind: z.literal("companion-reward"), pending: PersistedPendingRewardUnionSchema }),
    InterruptedFlowDestinationSchema,
  ])
  .catch({ kind: "none" })
  .default({ kind: "none" });

export type InterruptedFlow = z.infer<typeof InterruptedFlowSchema>;

// ===== ActiveRunData =====
// normalizeActiveRunData lives in ./normalize-active-run-data.ts — imported above.

export const ActiveRunDataSchema = z
  .object({
    characterId: CharacterIdSchema,
    runDeck: z.array(BattleCardSchema),
    runPlayerHealth: z.number().int().nonnegative().catch(0),
    runMaxHealth: z.number().int().positive().catch(30),
    runMetaMaxHealth: z.number().int().nonnegative().catch(0).default(0),
    roomsEncountered: z.number().int().nonnegative().catch(0),
    currentAct: z.number().int().min(1).max(ACTS_PER_RUN).catch(1),
    destinationIndexInAct: z.number().int().nonnegative().catch(0),
    completedDestinations: DestinationArraySchema,
    lastOfferedDestinations: DestinationArraySchema.default([]),
    destinationRoundsSinceOffered: z.record(z.string(), z.number().int().nonnegative()).catch({}).default({}),
    runTrinkets: z.array(z.string()).catch([]),
    encounteredRunEnemyIds: deduplicatedStringArraySchema().default([]),
    selectedDifficulty: DifficultyIdSchema.nullable().catch(null).default(null),
    contentSystemType: ContentSystemIdSchema.catch("campaign"),
    rng: RunRngStateSchema.default(() => createRunRngState()),
    labyrinthMap: LabyrinthMapSchema.nullable().catch(null),
    labyrinthPendingNode: LabyrinthNodePositionSchema,
    wildwoodDraft: WildwoodDraftStateSchema.default(null),
    starterDraftChoices: z.array(BattleCardSchema).nullable().catch(null).default(null),
    activeCombat: ActiveCombatDataSchema.catch(null).default(null),
    // Defaults match normalizeActiveRunData — required on Zod output without a post-cast.
    runTalentXP: TalentXPSchema.default({}),
    runMaterialsEarned: MaterialInventorySchema.default(emptyInventory()),
    currentScreen: z.preprocess(
      (value) => (value === "wildwood-recovery" ? "rewards" : value),
      z.enum(ROUTE_SCREEN_VALUES).nullable().catch(null).default(null),
    ),
    interruptedFlow: InterruptedFlowSchema,
    shopState: ShopPersistSchema.default(null),
    alchemistState: AlchemistPersistSchema.default(null),
    trinketShopState: TrinketShopPersistSchema.default(null),
    equipmentShopState: EquipmentShopPersistSchema.default(null),
    mysteryVisit: MysteryVisitPersistSchema,
    corruptionResult: CorruptionResultPersistSchema,
  })
  .transform((data) => normalizeActiveRunData(data))
  .refine((data) => data.contentSystemType !== "labyrinth" || data.labyrinthMap !== null, {
    message: "Labyrinth runs require a valid labyrinth map",
  })
  .refine((data) => data.contentSystemType !== "wildwood" || data.wildwoodDraft !== null, {
    message: "Wildwood Draft runs require versioned mode state",
  });

export type ParsedActiveRunData = z.output<typeof ActiveRunDataSchema>;
