// Damage-related card effect schemas and metadata.
import { z } from "zod";
import type { EffectKindDefinition } from "./definition";
import { DamageTypeSchema, EnemyStatusIdSchema } from "./shared-schemas";

export const damageEffectDefinition = {
  kind: "damage",
  schema: z.object({
    kind: z.literal("damage"),
    damageType: DamageTypeSchema,
    amount: z.number(),
    lifesteal: z.boolean().optional(),
    equalToBlock: z.boolean().optional(),
    equalToArmor: z.boolean().optional(),
    equalToGoldPercent: z.number().optional(),
    doubleIfEnemyBurning: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"damage">;

export const selfDamageEffectDefinition = {
  kind: "self-damage",
  schema: z.object({
    kind: z.literal("self-damage"),
    damageType: EnemyStatusIdSchema,
    amount: z.number(),
  }),
} satisfies EffectKindDefinition<"self-damage">;

export const randomDamageEffectDefinition = {
  kind: "random-damage",
  schema: z.object({
    kind: z.literal("random-damage"),
    minAmount: z.number(),
    maxAmount: z.number(),
  }),
} satisfies EffectKindDefinition<"random-damage">;

export const removeEnemyArmorEffectDefinition = {
  kind: "remove-enemy-armor",
  schema: z.object({
    kind: z.literal("remove-enemy-armor"),
    amount: z.number(),
  }),
} satisfies EffectKindDefinition<"remove-enemy-armor">;
