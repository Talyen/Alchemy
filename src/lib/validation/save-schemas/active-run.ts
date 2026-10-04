import { sanitizeWildwoodBossId, sanitizeWildwoodBossIds } from "@/lib/content-systems/wildwood/bosses";
import { shopItemSlotKey } from "@/lib/active-run-session/shop-offering-repair";
import { emptyInventory } from "@/lib/homestead/inventory";
import { ROUTE_SCREEN_VALUES } from "@/lib/routing";
import { z } from "zod";
import { normalizeActiveRunData } from "../normalize-active-run-data";
import { BattleCardSchema, parseSavedCardEntries, savedCardArraySchema } from "./battle-card-schemas";
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

const MysteryEventPersistSchema = z.object({
  id: z.string(),
  title: z.string(),
  art: z.string(),
  narrative: z.string(),
  choices: z.array(MysteryChoicePersistSchema),
});

const MysteryVisitObjectSchema = z.object({
  event: MysteryEventPersistSchema,
  chosenChoice: MysteryChoicePersistSchema.nullable().catch(null),
  cardChoices: savedCardArraySchema("mysteryVisit.cardChoices").nullable().catch(null),
  grantedTrinketIds: z.array(z.string()).catch([]),
  grantedGear: GearInstanceArraySchema.catch([]),
  chosenCardId: z.string().nullable().catch(null),
});
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
    freeRefreshUsed: z.boolean().catch(false),
    firstPurchaseUsed: z.boolean().catch(false),
    purchasedSlotKeys: deduplicatedStringArraySchema(),
  });
}

function repairSavedShopCards(cards: unknown[], purchasedSlotKeys: string[], path: string) {
  const purchased = new Set(purchasedSlotKeys);
  const entries = parseSavedCardEntries(cards, path);
  return {
    cards: entries.map(({ card }) => card),
    purchasedSlotKeys: entries.flatMap(({ card, index }, nextIndex) =>
      purchased.has(shopItemSlotKey(card.id, index)) ? [shopItemSlotKey(card.id, nextIndex)] : [],
    ),
  };
}

const AlchemyVisitSchema = z
  .object({
    offers: savedCardArraySchema("alchemyVisit.offers"),
    result: BattleCardSchema.nullable(),
    original: BattleCardSchema.nullable(),
    completed: z.boolean(),
  })
  .nullable()
  .catch(null);

const ShopObjectSchema = createShopObjectSchema({
  cards: z.array(z.unknown()),
  removeUsed: z.boolean().catch(false),
}).transform((state) => ({
  ...state,
  ...repairSavedShopCards(state.cards, state.purchasedSlotKeys, "shopState.cards"),
}));
const ShopPersistSchema = ShopObjectSchema.nullable().catch(null);

const AlchemistObjectSchema = createShopObjectSchema({
  potions: z.array(z.unknown()),
  mixUsed: z.boolean().catch(false),
}).transform((state) => {
  const repaired = repairSavedShopCards(state.potions, state.purchasedSlotKeys, "alchemistState.potions");
  return { ...state, potions: repaired.cards, purchasedSlotKeys: repaired.purchasedSlotKeys };
});
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
  draftChoices: savedCardArraySchema("wildwoodDraft.draftChoices"),
  remainingBossIds: WildwoodBossIdListSchema,
  previousBossId: OptionalWildwoodBossIdSchema,
  currentBossId: OptionalWildwoodBossIdSchema,
  currentCombatTraitIds: EncounterCombatTraitArraySchema.catch([]),
  currentRewardTraitIds: EncounterRewardTraitArraySchema.catch([]),
});
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
    // Empty or repaired choices still carry shared Gold/Materials and bonus
    // cards. Reward restoration decides whether the bundle has value to keep.
    gearChoices: z.preprocess(normalizeGearInstanceArray, z.array(GearInstanceSchema).catch([])),
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
  starterDraftChoices: savedCardArraySchema("starterDraftChoices").nullable().catch(null),
  activeCombat: ActiveCombatDataSchema.catch(null),
  currentScreen: z.enum(ROUTE_SCREEN_VALUES).nullable().catch(null),
  interruptedFlow: InterruptedFlowSchema,
  shopState: ShopPersistSchema,
  alchemistState: AlchemistPersistSchema,
  trinketShopState: TrinketShopPersistSchema,
  equipmentShopState: EquipmentShopPersistSchema,
  mysteryVisit: MysteryVisitPersistSchema,
  corruptionResult: CorruptionResultPersistSchema,
  campfireState: AlchemyVisitSchema,
  transmutationState: AlchemyVisitSchema,
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
