// Single parse path for persisted BattleState: structural Zod check + default merge.
import { z } from "zod";
import { type BattleState } from "@/lib/battle";
import { normalizePersistedBattleState } from "../normalize-persisted-battle-state";

const PersistedBattleStateWireSchema = z
  .object({
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
    enemyHealth: z.number(),
    enemyMaxHealth: z.number(),
    currentEnemy: z.record(z.string(), z.unknown()),
    enemyAttackEffects: z.array(z.unknown()),
    playerStatuses: z.record(z.string(), z.unknown()),
    enemyStatuses: z.record(z.string(), z.unknown()),
    flags: z.record(z.string(), z.unknown()),
    discoveredCardIds: z.array(z.unknown()),
    difficultyModifiers: z.array(z.unknown()),
  })
  .passthrough();

/** Validate wire shape, then deep-merge with `defaultBattleState()` for resume. */
export const PersistedBattleStateSchema = PersistedBattleStateWireSchema.transform((data) =>
  normalizePersistedBattleState(data as unknown as Partial<BattleState>),
);
