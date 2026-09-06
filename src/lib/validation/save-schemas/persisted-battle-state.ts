import { z } from "zod";
import { type BattleState } from "@/lib/battle";
import { normalizePersistedBattleState } from "../normalize-persisted-battle-state";
import { UniqueGearBattleStateSchema } from "./unique-gear-state";

const PersistedBattleStateWireSchema = z.looseObject({
  deck: z.array(z.unknown()),
  hand: z.array(z.unknown()),
  discard: z.array(z.unknown()),
  exhausted: z.array(z.unknown()),
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
  enemyAttackEffects: z.array(z.unknown()),
  playerStatuses: z.record(z.string(), z.unknown()),
  enemyStatuses: z.record(z.string(), z.unknown()),
  flags: z.record(z.string(), z.unknown()),
  uniqueGear: UniqueGearBattleStateSchema,
  discoveredCardIds: z.array(z.unknown()),
  difficultyModifiers: z.array(z.unknown()),
});

export const PersistedBattleStateSchema = PersistedBattleStateWireSchema.transform((data) =>
  normalizePersistedBattleState(data as unknown as Partial<BattleState>),
);
