import { EncounterRewardTraitArraySchema } from "./labyrinth-schemas";
import { z } from "zod";
import { type BattleState } from "@/lib/battle";
import { normalizePersistedBattleState } from "../normalize-persisted-battle-state";
import { BattleCardSchema } from "./battle-card-schemas";
import { UniqueGearBattleStateSchema } from "./unique-gear-state";

const PersistedBattleStateWireSchema = z.looseObject({
  deck: z.array(BattleCardSchema),
  hand: z.array(BattleCardSchema),
  discard: z.array(BattleCardSchema),
  exhausted: z.array(BattleCardSchema),
  wishOptions: z.array(BattleCardSchema).nullable().catch(null),
  wishQueue: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter(Array.isArray) : []),
    z.array(z.array(BattleCardSchema)),
  ),
  mana: z.number(),
  maxMana: z.number(),
  gold: z.number(),
  turn: z.number(),
  turnPhase: z.enum(["player", "enemy"]),
  playerHealth: z.number(),
  playerMaxHealth: z.number(),
  playerDodgeCount: z.number().int().nonnegative().catch(0),
  dodgeChanceFromDamage: z.number().nonnegative().catch(0),
  enemyHealth: z.number(),
  enemyMaxHealth: z.number(),
  currentEnemy: z.record(z.string(), z.unknown()),
  lastEnemyAbilityId: z.string().nullable().catch(null),
  playerStatuses: z.record(z.string(), z.unknown()),
  enemyStatuses: z.record(z.string(), z.unknown()),
  flags: z.record(z.string(), z.unknown()),
  uniqueGear: UniqueGearBattleStateSchema,
  encounterBenefits: EncounterRewardTraitArraySchema,
  discoveredCardIds: z.array(z.unknown()),
  difficultyModifiers: z.array(z.unknown()),
});

export const PersistedBattleStateSchema = PersistedBattleStateWireSchema.transform((data) =>
  normalizePersistedBattleState(data as unknown as Partial<BattleState>),
);
