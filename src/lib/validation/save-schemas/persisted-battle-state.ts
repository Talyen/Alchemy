import { EncounterRewardTraitArraySchema } from "./labyrinth-schemas";
import { z } from "zod";
import { defaultBattleState, type BattleSnapshot } from "@/lib/battle";
import { normalizePersistedBattleState } from "../normalize-persisted-battle-state";
import { keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { BattleCardEffectSchema, BattleCardSchema } from "./battle-card-schemas";
import { UniqueGearBattleStateSchema } from "./unique-gear-state";

// Load-tolerant fallbacks: one corrupt scalar or collection repairs to battle
// defaults instead of voiding the whole combat session. Only primitives are
// read from this snapshot; collections use fresh literals below so parses
// never share references.
const battleFallbacks = defaultBattleState();

const PersistedBattleStateWireSchema = z.looseObject({
  deck: z.array(BattleCardSchema).catch([]),
  hand: z.array(BattleCardSchema).catch([]),
  discard: z.array(BattleCardSchema).catch([]),
  exhausted: z.array(BattleCardSchema).catch([]),
  wishOptions: z.array(BattleCardSchema).nullable().catch(null),
  wishQueue: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter(Array.isArray) : []),
    z.array(z.array(BattleCardSchema)),
  ),
  pendingTurnStartEffects: z
    .array(
      z.object({
        remainingTurns: z.number().int().positive(),
        effects: z.array(BattleCardEffectSchema),
        sourceCard: z
          .object({
            id: z.string(),
            consume: z.boolean().optional(),
            tags: z.array(z.enum(Object.keys(keywordDefinitions) as KeywordId[])).optional(),
          })
          .optional(),
      }),
    )
    .catch([]),
  pendingForgeThresholds: z
    .array(z.object({ previousForge: z.number().int().nonnegative(), nextForge: z.number().int().nonnegative() }))
    .catch([]),
  mana: z.number().catch(battleFallbacks.mana),
  maxMana: z.number().catch(battleFallbacks.maxMana),
  gold: z.number().catch(battleFallbacks.gold),
  turn: z.number().catch(battleFallbacks.turn),
  turnPhase: z.enum(["player", "enemy"]).catch(battleFallbacks.turnPhase),
  playerHealth: z.number().catch(battleFallbacks.playerHealth),
  playerMaxHealth: z.number().catch(battleFallbacks.playerMaxHealth),
  playerDodgeCount: z.number().int().nonnegative().catch(0),
  dodgeChanceFromDamage: z.number().nonnegative().catch(0),
  enemyHealth: z.number().catch(battleFallbacks.enemyHealth),
  enemyMaxHealth: z.number().catch(battleFallbacks.enemyMaxHealth),
  currentEnemy: z.record(z.string(), z.unknown()).catch({}),
  lastEnemyAbilityId: z.string().nullable().catch(null),
  playerStatuses: z.record(z.string(), z.unknown()).catch({}),
  enemyStatuses: z.record(z.string(), z.unknown()).catch({}),
  flags: z.record(z.string(), z.unknown()).catch({}),
  uniqueGear: UniqueGearBattleStateSchema,
  encounterBenefits: EncounterRewardTraitArraySchema,
  discoveredCardIds: z.array(z.unknown()).catch([]),
  difficultyModifiers: z.array(z.unknown()).catch([]),
});

// A battle block without any card piles is a fragment, not a fight: repair
// corruption inside a battle, but never fabricate one from scattered fields
// (an empty deck with a placeholder enemy could resume into an unplayable
// battle, while dropping the block returns the run to its pre-combat state).
function hasBattleCardPiles(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["deck", "hand", "discard", "exhausted"].some((key) => Array.isArray(record[key]));
}

export const PersistedBattleStateSchema = z
  .unknown()
  .refine(hasBattleCardPiles, { message: "Battle block has no card piles" })
  .pipe(PersistedBattleStateWireSchema)
  .transform((data) => normalizePersistedBattleState(data as unknown as Partial<BattleSnapshot>));
