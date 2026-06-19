// Status-related card effect schemas and metadata.
import { z } from "zod";
import type { EffectKindDefinition } from "./definition";
import { EnemyStatusIdSchema, DamageTypeSchema } from "./shared-schemas";

export const playerStatusEffectDefinition = {
  kind: "player-status",
  schema: z.object({
    kind: z.literal("player-status"),
    status: z.enum(["block", "armor", "forge", "haste", "phoenixFeather"]),
    amount: z.number(),
    perManaCrystal: z.number().optional(),
  }),
} satisfies EffectKindDefinition<"player-status">;

export const enemyStatusEffectDefinition = {
  kind: "enemy-status",
  schema: z.object({
    kind: z.literal("enemy-status"),
    status: EnemyStatusIdSchema,
    amount: z.number(),
  }),
} satisfies EffectKindDefinition<"enemy-status">;

export const removeHarmfulStatusEffectDefinition = {
  kind: "remove-harmful-status",
  schema: z.object({
    kind: z.literal("remove-harmful-status"),
    amount: z.number(),
  }),
} satisfies EffectKindDefinition<"remove-harmful-status">;

export const removePlayerStatusEffectDefinition = {
  kind: "remove-player-status",
  schema: z.object({
    kind: z.literal("remove-player-status"),
    status: EnemyStatusIdSchema,
  }),
} satisfies EffectKindDefinition<"remove-player-status">;

export const multiplyEnemyStatusEffectDefinition = {
  kind: "multiply-enemy-status",
  schema: z.object({
    kind: z.literal("multiply-enemy-status"),
    status: EnemyStatusIdSchema,
    factor: z.number(),
  }),
} satisfies EffectKindDefinition<"multiply-enemy-status">;

export const cleansePlayerStatusToDamageEffectDefinition = {
  kind: "cleanse-player-status-to-damage",
  schema: z.object({
    kind: z.literal("cleanse-player-status-to-damage"),
    status: z.literal("burn"),
    damageType: DamageTypeSchema,
    removeAll: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"cleanse-player-status-to-damage">;
