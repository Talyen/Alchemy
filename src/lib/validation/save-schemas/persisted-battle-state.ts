import { EncounterRewardTraitArraySchema } from "./labyrinth-schemas";
import { z } from "zod";
import { defaultBattleState } from "@/lib/battle";
import { normalizePersistedBattleState } from "../normalize-persisted-battle-state";
import {
  BattleCardEffectSchema,
  CompanionIdSchema,
  EnemyStatusIdSchema,
  isEnemyId,
  type BattleCard,
  type DifficultyModifier,
} from "@/lib/game-data";
import { parseSavedCardArray, savedCardArraySchema, SavedKeywordArraySchema } from "./battle-card-schemas";
import { MaterialInventorySchema } from "./schema-enums";
import { UniqueGearBattleStateSchema } from "./unique-gear-state";
import { deduplicatedStringArraySchema, parseValidEntries } from "./validation-utils";

// Load-tolerant fallbacks: one corrupt scalar or collection repairs to battle
// defaults instead of voiding the whole combat session. Only primitives are
// read from this snapshot; collections use fresh literals below so parses
// never share references.
const battleFallbacks = defaultBattleState();

const difficultyModifierSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("enemy-starting-armor"), amount: z.number().nonnegative().lt(Number.MAX_SAFE_INTEGER) }),
    z.object({
      kind: z.literal("increase-enemy-physical-damage"),
      amount: z.number().nonnegative().lt(Number.MAX_SAFE_INTEGER),
    }),
    z.object({
      kind: z.literal("increase-enemy-damage"),
      amount: z.number().nonnegative().lt(Number.MAX_SAFE_INTEGER),
    }),
    z.object({
      kind: z.literal("increase-enemy-status"),
      status: EnemyStatusIdSchema.exclude(["stun"]),
      amount: z.number().nonnegative().lt(Number.MAX_SAFE_INTEGER),
    }),
    z.object({ kind: z.literal("enemy-attacks-gain-leech") }),
    z.object({ kind: z.literal("start-block"), amount: z.number().nonnegative().lt(Number.MAX_SAFE_INTEGER) }),
    z.object({ kind: z.literal("start-max-mana"), amount: z.number().nonnegative().lt(Number.MAX_SAFE_INTEGER) }),
    z.object({ kind: z.literal("gold-multiplier"), amount: z.number().nonnegative().lt(Number.MAX_SAFE_INTEGER) }),
    z.object({ kind: z.literal("start-companion"), companionId: CompanionIdSchema.optional() }),
    z.object({ kind: z.literal("enemy-health-multiplier"), amount: z.number().positive().lt(Number.MAX_SAFE_INTEGER) }),
    z.object({ kind: z.literal("enemy-damage-multiplier"), amount: z.number().positive().lt(Number.MAX_SAFE_INTEGER) }),
  ])
  .transform((modifier): DifficultyModifier => {
    if (modifier.kind !== "start-companion") return modifier;
    return modifier.companionId === undefined
      ? { kind: modifier.kind }
      : { kind: modifier.kind, companionId: modifier.companionId };
  });

const pendingTurnStartEffectSchema = z
  .object({
    remainingTurns: z.number().int().min(1).max(10),
    effects: z.array(z.unknown()).transform((effects) =>
      parseValidEntries(effects, BattleCardEffectSchema, {
        path: "pendingTurnStartEffects.effects",
        message: "malformed scheduled child effect was dropped",
      }),
    ),
    sourceCard: z
      .object({
        id: z.string(),
        consume: z.boolean().optional().catch(undefined),
        tags: SavedKeywordArraySchema.optional().catch(undefined),
      })
      .optional()
      .catch(undefined),
  })
  .transform(({ sourceCard, ...pulse }) => ({
    ...pulse,
    ...(sourceCard
      ? {
          sourceCard: {
            id: sourceCard.id,
            ...(sourceCard.consume === undefined ? {} : { consume: sourceCard.consume }),
            ...(sourceCard.tags === undefined ? {} : { tags: sourceCard.tags }),
          } satisfies Pick<BattleCard, "id" | "consume" | "tags">,
        }
      : {}),
  }));

const PersistedBattleStateWireSchema = z.looseObject({
  pendingMaterials: MaterialInventorySchema,
  pendingCardBleedLeechHealing: z.number().int().nonnegative().catch(0),
  deck: savedCardArraySchema("deck").catch([]),
  hand: savedCardArraySchema("hand").catch([]),
  pendingHandCards: savedCardArraySchema("pendingHandCards").catch([]),
  discard: savedCardArraySchema("discard").catch([]),
  exhausted: savedCardArraySchema("exhausted").catch([]),
  wishOptions: savedCardArraySchema("wishOptions").nullable().catch(null),
  wishQueue: z
    .array(z.unknown())
    .transform((queues) => {
      const parsed: Array<ReturnType<typeof parseSavedCardArray>> = [];
      queues.forEach((queue, index) => {
        if (Array.isArray(queue)) parsed.push(parseSavedCardArray(queue, `wishQueue[${index}]`));
      });
      return parsed;
    })
    .catch([]),
  pendingTurnStartEffects: z
    .array(z.unknown())
    .transform((entries) =>
      parseValidEntries(entries, pendingTurnStartEffectSchema, {
        path: "pendingTurnStartEffects",
        message: "malformed scheduled effect was dropped",
      }),
    )
    .catch([]),
  mana: z.number().catch(battleFallbacks.mana),
  maxMana: z.number().catch(battleFallbacks.maxMana),
  gold: z.number().catch(battleFallbacks.gold),
  turn: z.number().catch(battleFallbacks.turn),
  turnPhase: z.enum(["player", "enemy"]).catch(battleFallbacks.turnPhase),
  playerHealth: z.number().catch(battleFallbacks.playerHealth),
  playerMaxHealth: z.number().catch(battleFallbacks.playerMaxHealth),
  playerDodgeCount: z.number().int().nonnegative().catch(0),
  dodgeChanceFromDamage: z.number().nonnegative().lt(Number.MAX_SAFE_INTEGER).catch(0),
  enemyHealth: z.number().catch(battleFallbacks.enemyHealth),
  enemyMaxHealth: z.number().catch(battleFallbacks.enemyMaxHealth),
  currentEnemy: z.record(z.string(), z.unknown()).catch({}),
  lastEnemyAbilityId: z.string().nullable().catch(null),
  playerStatuses: z.record(z.string(), z.unknown()).catch({}),
  enemyStatuses: z.record(z.string(), z.unknown()).catch({}),
  flags: z.record(z.string(), z.unknown()).catch({}),
  reactions: z.record(z.string(), z.unknown()).catch({}),
  uniqueGear: UniqueGearBattleStateSchema,
  encounterBenefits: EncounterRewardTraitArraySchema,
  discoveredCardIds: deduplicatedStringArraySchema(),
  appliesFightPacing: z.boolean().catch(battleFallbacks.appliesFightPacing),
  difficultyModifiers: z
    .array(z.unknown())
    .transform((modifiers) => parseValidEntries(modifiers, difficultyModifierSchema))
    .catch([]),
});

const BATTLE_CARD_PILES = ["deck", "hand", "pendingHandCards", "discard", "exhausted"] as const;

// A battle block without any card piles is a fragment, not a fight: repair
// corruption inside a battle, but never fabricate one from scattered fields
// (an empty deck with a placeholder enemy could resume into an unplayable
// battle, while dropping the block returns the run to its pre-combat state).
function hasBattleCardPiles(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return BATTLE_CARD_PILES.some((key) => Array.isArray(record[key]));
}

function hasKnownEnemy(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const enemy = (value as Record<string, unknown>).currentEnemy;
  if (!enemy || typeof enemy !== "object" || Array.isArray(enemy)) return false;
  const id = (enemy as Record<string, unknown>).id;
  return typeof id === "string" && isEnemyId(id);
}

export const PersistedBattleStateSchema = z
  .unknown()
  .refine(hasBattleCardPiles, { message: "Battle block has no card piles" })
  .refine(hasKnownEnemy, { message: "Battle block has no known enemy" })
  .pipe(PersistedBattleStateWireSchema)
  .transform((data) => normalizePersistedBattleState(data));
