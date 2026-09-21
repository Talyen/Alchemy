import { z } from "zod";
import type { EffectKindDefinition } from "./shared-schemas";
import {
  AmountSchema,
  DamageTypeSchema,
  EnemyStatusDamageIdSchema,
  EnemyStatusIdSchema,
  PositiveAmountSchema,
} from "./shared-schemas";

const playerStatusEffectDefinition = {
  kind: "player-status",
  schema: z
    .object({
      kind: z.literal("player-status"),
      status: z.enum(["block", "armor", "thorns", "forge", "haste", "phoenixFeather"]),
      amount: AmountSchema,
      statusPool: z
        .array(z.enum(["block", "armor", "thorns", "forge"]))
        .min(2)
        .optional(),
      perManaCrystal: AmountSchema.optional(),
      convertCurrentMana: z.number().int().min(0).max(100).optional(),
    })
    .refine((data) => !(data.perManaCrystal !== undefined && data.convertCurrentMana !== undefined), {
      message: "player-status cannot have both perManaCrystal and convertCurrentMana",
    }),
} satisfies EffectKindDefinition<"player-status">;

const enemyStatusEffectDefinition = {
  kind: "enemy-status",
  schema: z.object({
    kind: z.literal("enemy-status"),
    status: EnemyStatusIdSchema,
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"enemy-status">;

const removeHarmfulStatusEffectDefinition = {
  kind: "remove-harmful-status",
  schema: z
    .object({
      kind: z.literal("remove-harmful-status"),
      // Omitted when removeAll is set; old saves may still carry an ignored amount.
      amount: PositiveAmountSchema.optional(),
      removeAll: z.boolean().optional(),
    })
    .refine((data) => data.removeAll === true || data.amount !== undefined, {
      message: "remove-harmful-status requires amount unless removeAll is set",
    }),
} satisfies EffectKindDefinition<"remove-harmful-status">;

const removePlayerStatusEffectDefinition = {
  kind: "remove-player-status",
  schema: z.object({
    kind: z.literal("remove-player-status"),
    status: EnemyStatusDamageIdSchema,
  }),
} satisfies EffectKindDefinition<"remove-player-status">;

const multiplyEnemyStatusEffectDefinition = {
  kind: "multiply-enemy-status",
  schema: z.object({
    kind: z.literal("multiply-enemy-status"),
    status: EnemyStatusDamageIdSchema,
    factor: z.number().int().min(1).max(10),
  }),
} satisfies EffectKindDefinition<"multiply-enemy-status">;

const cleansePlayerStatusToDamageEffectDefinition = {
  kind: "cleanse-player-status-to-damage",
  schema: z.object({
    kind: z.literal("cleanse-player-status-to-damage"),
    status: z.literal("burn"),
    damageType: DamageTypeSchema,
  }),
} satisfies EffectKindDefinition<"cleanse-player-status-to-damage">;

export const STATUS_EFFECT_DEFINITIONS = [
  playerStatusEffectDefinition,
  enemyStatusEffectDefinition,
  removeHarmfulStatusEffectDefinition,
  removePlayerStatusEffectDefinition,
  multiplyEnemyStatusEffectDefinition,
  cleansePlayerStatusToDamageEffectDefinition,
] as const;
