import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import {
  AmountSchema,
  DamageTypeSchema,
  EnemyStatusDamageIdSchema,
  EnemyStatusIdSchema,
  PositiveAmountSchema,
} from "./shared-schemas";

export const playerStatusEffectDefinition = {
  kind: "player-status",
  schema: z
    .object({
      kind: z.literal("player-status"),
      status: z.enum(["block", "armor", "thorns", "forge", "haste", "phoenixFeather"]),
      amount: AmountSchema,
      perManaCrystal: AmountSchema.optional(),
      convertCurrentMana: z.number().int().min(0).max(100).optional(),
    })
    .refine((data) => !(data.perManaCrystal !== undefined && data.convertCurrentMana !== undefined), {
      message: "player-status cannot have both perManaCrystal and convertCurrentMana",
    }),
} satisfies EffectKindDefinition<"player-status">;

export const enemyStatusEffectDefinition = {
  kind: "enemy-status",
  schema: z.object({
    kind: z.literal("enemy-status"),
    status: EnemyStatusIdSchema,
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"enemy-status">;

export const removeHarmfulStatusEffectDefinition = {
  kind: "remove-harmful-status",
  schema: z.object({
    kind: z.literal("remove-harmful-status"),
    amount: PositiveAmountSchema,
    removeAll: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"remove-harmful-status">;

export const removePlayerStatusEffectDefinition = {
  kind: "remove-player-status",
  schema: z.object({
    kind: z.literal("remove-player-status"),
    status: EnemyStatusDamageIdSchema,
  }),
} satisfies EffectKindDefinition<"remove-player-status">;

export const multiplyEnemyStatusEffectDefinition = {
  kind: "multiply-enemy-status",
  schema: z.object({
    kind: z.literal("multiply-enemy-status"),
    status: EnemyStatusDamageIdSchema,
    factor: z.number().int().min(1).max(10),
  }),
} satisfies EffectKindDefinition<"multiply-enemy-status">;

export const cleansePlayerStatusToDamageEffectDefinition = {
  kind: "cleanse-player-status-to-damage",
  schema: z.object({
    kind: z.literal("cleanse-player-status-to-damage"),
    status: z.literal("burn"),
    damageType: DamageTypeSchema,
  }),
} satisfies EffectKindDefinition<"cleanse-player-status-to-damage">;
