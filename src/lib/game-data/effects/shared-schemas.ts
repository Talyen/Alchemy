import { z } from "zod";
import { companionLibrary } from "../companions";
import { DAMAGE_TYPES, type CompanionId } from "../types";

export const DamageTypeSchema = z.enum(DAMAGE_TYPES);
export const ENEMY_STATUS_IDS = [
  "burn",
  "poison",
  "bleed",
  "freeze",
  "stun",
  "burnBonus",
  "freezeBonus",
  "thorns",
  "onAttackBleed",
] as const;
export const ENEMY_STATUS_DAMAGE_IDS = ["burn", "poison", "bleed", "freeze", "stun", "thorns"] as const;
export const EnemyStatusIdSchema = z.enum(ENEMY_STATUS_IDS);
export const EnemyStatusDamageIdSchema = z.enum(ENEMY_STATUS_DAMAGE_IDS);

export const PositiveAmountSchema = z.number().int().min(1).max(999);

const COMPANION_IDS = Object.keys(companionLibrary) as [CompanionId, ...CompanionId[]];
export const CompanionIdSchema = z.enum(COMPANION_IDS);

export const AmountSchema = z.number().int().min(0).max(999);

export function defineAmountEffect<const K extends string>(kind: K) {
  return {
    kind,
    schema: z.object({ kind: z.literal(kind), amount: PositiveAmountSchema }),
  };
}

export function defineFlagEffect<const K extends string>(kind: K) {
  return {
    kind,
    schema: z.object({ kind: z.literal(kind) }),
  };
}

export function defineRangedEffect<const K extends string>(kind: K) {
  return {
    kind,
    schema: z
      .object({
        kind: z.literal(kind),
        minAmount: PositiveAmountSchema,
        maxAmount: PositiveAmountSchema,
      })
      .refine((data) => data.maxAmount >= data.minAmount, {
        message: `${kind} maxAmount must be >= minAmount`,
      }),
  };
}

export interface EffectKindDefinition<K extends string> {
  kind: K;
  schema: z.ZodType<{ kind: K }>;
}
