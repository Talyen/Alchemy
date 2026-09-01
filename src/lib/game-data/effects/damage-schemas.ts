import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import { AmountSchema, DamageTypeSchema, EnemyStatusIdSchema, PositiveAmountSchema } from "./shared-schemas";

export const damageEffectDefinition = {
  kind: "damage",
  schema: z
    .object({
      kind: z.literal("damage"),
      damageType: DamageTypeSchema,
      amount: AmountSchema,
      lifesteal: z.boolean().optional(),
      equalToBlock: z.boolean().optional(),
      equalToArmor: z.boolean().optional(),
      equalToGoldPercent: z.number().int().min(0).max(100).optional(),
      doubleIfEnemyBurning: z.boolean().optional(),
      tripleIfEnemyNotBurning: z.boolean().optional(),
    })
    .refine((data) => !(data.equalToBlock && data.equalToArmor), {
      message: "damage effect cannot have both equalToBlock and equalToArmor",
    })
    .refine(
      (data) =>
        [data.equalToBlock, data.equalToArmor, data.equalToGoldPercent !== undefined].filter(Boolean).length <= 1,
      {
        message: "damage effect must have at most one of equalToBlock/equalToArmor/equalToGoldPercent",
      },
    )
    .refine((data) => !(data.doubleIfEnemyBurning && data.tripleIfEnemyNotBurning), {
      message: "damage effect cannot have both doubleIfEnemyBurning and tripleIfEnemyNotBurning",
    }),
} satisfies EffectKindDefinition<"damage">;

export const selfDamageEffectDefinition = {
  kind: "self-damage",
  schema: z.object({
    kind: z.literal("self-damage"),
    damageType: EnemyStatusIdSchema,
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"self-damage">;

export const randomDamageEffectDefinition = {
  kind: "random-damage",
  schema: z
    .object({
      kind: z.literal("random-damage"),
      minAmount: PositiveAmountSchema,
      maxAmount: PositiveAmountSchema,
    })
    .refine((data) => data.maxAmount >= data.minAmount, {
      message: "random-damage maxAmount must be >= minAmount",
    }),
} satisfies EffectKindDefinition<"random-damage">;

export const removeEnemyArmorEffectDefinition = {
  kind: "remove-enemy-armor",
  schema: z.object({
    kind: z.literal("remove-enemy-armor"),
    amount: PositiveAmountSchema,
  }),
} satisfies EffectKindDefinition<"remove-enemy-armor">;
