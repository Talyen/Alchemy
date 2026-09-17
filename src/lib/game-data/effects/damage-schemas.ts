import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import {
  AmountSchema,
  DamageTypeSchema,
  PositiveAmountSchema,
  defineRangedEffect,
  EnemyStatusDamageIdSchema,
} from "./shared-schemas";

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
      equalToForge: z.boolean().optional(),
      ignoreArmor: z.boolean().optional(),
      equalToGoldPercent: z.number().int().min(0).max(100).optional(),
      doubleIfEnemyBurning: z.boolean().optional(),
      doubleIfEnemyBleeding: z.boolean().optional(),
      tripleIfEnemyNotBurning: z.boolean().optional(),
      detonateIfEnemyBurning: z.boolean().optional(),
      damageTypePool: z.array(DamageTypeSchema).min(2).optional(),
    })
    .refine((data) => !(data.equalToBlock && data.equalToArmor), {
      message: "damage effect cannot have both equalToBlock and equalToArmor",
    })
    .refine(
      (data) =>
        [data.equalToBlock, data.equalToArmor, data.equalToForge, data.equalToGoldPercent !== undefined].filter(Boolean)
          .length <= 1,
      {
        message: "damage effect must have at most one of equalToBlock/equalToArmor/equalToForge/equalToGoldPercent",
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
    damageType: EnemyStatusDamageIdSchema,
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"self-damage">;

export const randomDamageEffectDefinition = defineRangedEffect(
  "random-damage",
) satisfies EffectKindDefinition<"random-damage">;

export const removeEnemyArmorEffectDefinition = {
  kind: "remove-enemy-armor",
  schema: z
    .object({
      kind: z.literal("remove-enemy-armor"),
      // Omitted when removeAll is set; old saves may still carry an ignored amount.
      amount: PositiveAmountSchema.optional(),
      removeAll: z.boolean().optional(),
    })
    .refine((data) => data.removeAll === true || data.amount !== undefined, {
      message: "remove-enemy-armor requires amount unless removeAll is set",
    }),
} satisfies EffectKindDefinition<"remove-enemy-armor">;
