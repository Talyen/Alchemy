import { sanitizeWildwoodBossId, sanitizeWildwoodBossIds } from "@/lib/content-systems/wildwood/bosses";
import { emptyInventory } from "@/lib/homestead/inventory";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing";
import { z } from "zod";
import { normalizeActiveRunData } from "../normalize-active-run-data";
import { BattleCardSchema } from "./battle-card-schemas";
import { GearInstanceArraySchema, GearInstanceSchema, normalizeGearInstanceArray } from "./gear-schemas";
import {
  EncounterCombatTraitArraySchema,
  EncounterRewardTraitArraySchema,
  LabyrinthMapSchema,
  LabyrinthPendingNodeSchema,
} from "./labyrinth-schemas";
import { PersistedBattleStateSchema } from "./persisted-battle-state";
import { RunProgressSchema } from "./run-progress";
import {
  ContentSystemIdSchema,
  DestinationArraySchema,
  EnemyTypeSchema,
  MaterialIdSchema,
  MaterialInventorySchema,
} from "./schema-enums";
import { deduplicatedStringArraySchema } from "./validation-utils";

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
  z.object({ kind: z.literal("gainRandomGear") }),
  z.object({ kind: z.literal("gainGeneratedGear"), baseItemId: z.string(), astral: z.literal(true).optional() }),
  z.object({ kind: z.literal("gainMaterial"), material: MaterialIdSchema, amount: z.number() }),
]);

const MysteryChoicePersistSchema = z.object({
  label: z.string(),
  effects: z.array(MysteryEffectSchema),
});

const MysteryVisitObjectSchema = z.object({
  eventId: z.string(),
  chosenChoice: MysteryChoicePersistSchema.nullable().catch(null),
  pendingRemoval: z.boolean().catch(false),
  cardChoices: z.array(BattleCardSchema).nullable().catch(null),
  grantedTrinketIds: z.array(z.string()).catch([]),
  grantedGear: GearInstanceArraySchema.catch([]),
  chosenCardId: z.string().nullable().catch(null),
  resolvedTrinketIds: z.array(z.string()).catch([]),
});
export type MysteryVisitState = z.output<typeof MysteryVisitObjectSchema>;
const MysteryVisitPersistSchema = MysteryVisitObjectSchema.nullable().catch(null);

const CorruptionResultPersistSchema = z
  .object({
    originalCard: BattleCardSchema,
    corruptedCard: BattleCardSchema,
    transformed: z.boolean(),
    delta: z.union([z.literal(1), z.literal(-1)]),
  })
  .nullable()
  .catch(null);

const PersistedBattleTransitionSchema = z
  .union([
    z.object({
      kind: z.literal("opening-draw"),
      resultState: PersistedBattleStateSchema,
    }),
    z.object({
      kind: z.literal("enemy-turn"),
      resultState: PersistedBattleStateSchema,
      playerTurnSkipped: z.boolean(),
    }),
    z.object({ kind: z.literal("continue-end-turn") }),
    z.object({ kind: z.literal("legacy-enemy-turn") }),
  ])
  .nullable()
  .catch(null);

const ActiveCombatObjectSchema = z.object({
  battleState: PersistedBattleStateSchema,
  pendingBattleTransition: PersistedBattleTransitionSchema,
  activeLabyrinthModifiers: EncounterCombatTraitArraySchema,
  activeLabyrinthRewardModifiers: EncounterRewardTraitArraySchema,
});
export type ActiveCombatData = z.output<typeof ActiveCombatObjectSchema>;
const ActiveCombatDataSchema = ActiveCombatObjectSchema.nullable().catch(null);

const WildwoodBossIdListSchema = z.array(z.string()).transform((ids) => sanitizeWildwoodBossIds(ids));
const OptionalWildwoodBossIdSchema = z
  .string()
  .nullable()
  .transform((id) => sanitizeWildwoodBossId(id))
  .catch(null);

function createShopObjectSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    ...shape,
    refreshesLeft: z.number().int().nonnegative().catch(0),
    firstPurchaseUsed: z.boolean().catch(false),
    purchasedSlotKeys: deduplicatedStringArraySchema(),
  });
}

const ShopObjectSchema = createShopObjectSchema({
  cards: z.array(BattleCardSchema),
  removeUsed: z.boolean().catch(false),
});
export type ShopState = z.output<typeof ShopObjectSchema>;
const ShopPersistSchema = ShopObjectSchema.nullable().catch(null);

const AlchemistObjectSchema = createShopObjectSchema({
  potions: z.array(BattleCardSchema),
  mixUsed: z.boolean().catch(false),
});
export type AlchemistState = z.output<typeof AlchemistObjectSchema>;
const AlchemistPersistSchema = AlchemistObjectSchema.nullable().catch(null);

const TrinketShopObjectSchema = createShopObjectSchema({
  trinketIds: z.array(z.string()),
});
const TrinketShopPersistSchema = TrinketShopObjectSchema.nullable().catch(null);

const EquipmentShopObjectSchema = createShopObjectSchema({
  gear: GearInstanceArraySchema,
});
const EquipmentShopPersistSchema = EquipmentShopObjectSchema.nullable().catch(null);

const WildwoodDraftObjectSchema = z.object({
  phase: z.enum(["draft", "battle", "reward", "removal"]),
  draftChoices: z.array(BattleCardSchema),
  remainingBossIds: WildwoodBossIdListSchema,
  previousBossId: OptionalWildwoodBossIdSchema,
  currentBossId: OptionalWildwoodBossIdSchema,
  currentCombatTraitIds: EncounterCombatTraitArraySchema.catch([]),
  currentRewardTraitIds: EncounterRewardTraitArraySchema.catch([]),
});
export type WildwoodDraftState = z.output<typeof WildwoodDraftObjectSchema>;
const WildwoodDraftStateSchema = WildwoodDraftObjectSchema.nullable().catch(null);

const PersistedPendingRewardBaseSchema = {
  companionChoiceIds: z.array(z.string()).catch([]),
  selectedId: z.string().nullable().catch(null),
  gold: z.number().int().nonnegative().catch(0),
  materials: MaterialInventorySchema.catch(emptyInventory()),
  destinations: DestinationArraySchema,
  selectedBossId: z.string().nullable().catch(null),
  lastVictoryEnemyType: EnemyTypeSchema.nullable().catch(null),
  lastVictoryContentSystem: ContentSystemIdSchema.nullable().catch(null),
};

function createChoicePendingRewardSchema(rewardType: "card" | "boon" | "trinket") {
  return z.object({
    rewardType: z.literal(rewardType),
    choiceIds: z.array(z.string()),
    ...PersistedPendingRewardBaseSchema,
  });
}

const PersistedPendingRewardUnionSchema = z.discriminatedUnion("rewardType", [
  createChoicePendingRewardSchema("card"),
  createChoicePendingRewardSchema("boon"),
  createChoicePendingRewardSchema("trinket"),
  z.object({
    rewardType: z.literal("gear"),
    // If every saved gear instance is invalid (catalog rotation), min(1) fails
    // and InterruptedFlow falls back to {kind:"none"}. Intentional load repair:
    // a gear reward with no valid choices cannot be offered, and restore
    // already maps empty gear to null. Shared gold/materials on the same
    // pending reward are dropped with it; preserving them is a future change.
    gearChoices: z.preprocess(normalizeGearInstanceArray, z.array(GearInstanceSchema).min(1)),
    ...PersistedPendingRewardBaseSchema,
  }),
]);

export type PersistedPendingReward = z.infer<typeof PersistedPendingRewardUnionSchema>;

const InterruptedFlowDestinationSchema = z.object({
  kind: z.literal("destination"),
  destinations: DestinationArraySchema,
  selectedBossId: z.string().nullable().catch(null),
  lastVictoryEnemyType: EnemyTypeSchema.nullable().catch(null),
  lastVictoryContentSystem: ContentSystemIdSchema.nullable().catch(null),
});

const InterruptedFlowSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("primary-reward"), pending: PersistedPendingRewardUnionSchema }),
    z.object({ kind: z.literal("companion-reward"), pending: PersistedPendingRewardUnionSchema }),
    InterruptedFlowDestinationSchema,
  ])
  .catch({ kind: "none" as const });

export type InterruptedFlow = z.infer<typeof InterruptedFlowSchema>;

const ActiveRunDataObjectSchema = z.object({
  ...RunProgressSchema.shape,
  labyrinthMap: LabyrinthMapSchema.nullable().catch(null),
  labyrinthPendingNode: LabyrinthPendingNodeSchema,
  activeLabyrinthModifiers: EncounterCombatTraitArraySchema,
  activeLabyrinthRewardModifiers: EncounterRewardTraitArraySchema,
  wildwoodDraft: WildwoodDraftStateSchema,
  starterDraftChoices: z.array(BattleCardSchema).nullable().catch(null),
  activeCombat: ActiveCombatDataSchema.catch(null),
  currentScreen: z.enum(ROUTE_SCREEN_VALUES).nullable().catch(null),
  interruptedFlow: InterruptedFlowSchema,
  shopState: ShopPersistSchema,
  alchemistState: AlchemistPersistSchema,
  trinketShopState: TrinketShopPersistSchema,
  equipmentShopState: EquipmentShopPersistSchema,
  mysteryVisit: MysteryVisitPersistSchema,
  corruptionResult: CorruptionResultPersistSchema,
});

export type ValidatedActiveRunData = z.output<typeof ActiveRunDataObjectSchema>;

export const ActiveRunDataSchema = ActiveRunDataObjectSchema.transform(normalizeActiveRunData)
  .refine(
    (data) =>
      data.contentSystemType !== "labyrinth" ||
      data.labyrinthMap !== null ||
      (data.characterId === "wildcard" && data.starterDraftChoices !== null && data.activeCombat === null),
    { message: "Labyrinth runs require a valid labyrinth map or an unfinished Wildcard starter draft" },
  )
  .refine((data) => data.contentSystemType !== "wildwood" || data.wildwoodDraft !== null, {
    message: "Wildwood Draft runs require versioned mode state",
  });

export type ParsedActiveRunData = z.output<typeof ActiveRunDataSchema>;
