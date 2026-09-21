import { z } from "zod";
import type { EffectKindDefinition } from "./shared-schemas";
import { AmountSchema, DamageTypeSchema, EnemyStatusDamageIdSchema, PositiveAmountSchema } from "./shared-schemas";

const damageEffectDefinition = {
  kind: "damage",
  schema: z
    .object({
      kind: z.literal("damage"),
      damageType: DamageTypeSchema,
      amount: AmountSchema,
      lifesteal: z.boolean().optional(),
      equalToBlock: z.boolean().optional(),
      equalToBlockPercent: z.number().int().min(1).max(100).optional(),
      equalToArmor: z.boolean().optional(),
      equalToForge: z.boolean().optional(),
      ignoreArmor: z.boolean().optional(),
      ignoreBlock: z.boolean().optional(),
      blockCost: PositiveAmountSchema.optional(),
      blockDamageBonus: AmountSchema.optional(),
      damageTypeIfTargetHasBlock: DamageTypeSchema.optional(),
      damageTypeIfTargetFrozen: DamageTypeSchema.optional(),
      amountIfTargetFrozen: AmountSchema.optional(),
      equalToGoldPercent: z.number().int().min(0).max(100).optional(),
      doubleIfEnemyBurning: z.boolean().optional(),
      doubleIfEnemyBleeding: z.boolean().optional(),
      doubleIfEnemyNotBurning: z.boolean().optional(),
      tripleIfEnemyNotBurning: z.boolean().optional(),
      detonateAllBurn: z.boolean().optional(),
      detonateAllBleed: z.boolean().optional(),
      detonateIfEnemyBurning: z.boolean().optional(),
      damageTypePool: z.array(DamageTypeSchema).min(2).optional(),
    })
    .refine((data) => (data.blockCost === undefined) === (data.blockDamageBonus === undefined), {
      message: "Block payment requires both cost and damage bonus",
    })
    .refine((data) => (data.damageTypeIfTargetFrozen === undefined) === (data.amountIfTargetFrozen === undefined), {
      message: "Frozen alternative requires both damage type and amount",
    })
    .refine(
      (data) => {
        const conditions = [
          data.blockCost !== undefined,
          !!data.damageTypeIfTargetHasBlock,
          !!data.damageTypeIfTargetFrozen,
        ];
        return (
          conditions.filter(Boolean).length <= 1 &&
          (!conditions.some(Boolean) ||
            !(
              data.damageTypePool !== undefined ||
              data.equalToBlock === true ||
              data.equalToArmor === true ||
              data.equalToForge === true ||
              data.equalToGoldPercent !== undefined
            ))
        );
      },
      { message: "Conditional damage cannot combine with another damage selector" },
    )
    .refine((data) => !(data.equalToBlock && data.equalToArmor), {
      message: "damage effect cannot have both equalToBlock and equalToArmor",
    })
    .refine((data) => data.equalToBlockPercent === undefined || data.equalToBlock === true, {
      message: "equalToBlockPercent requires equalToBlock",
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
    })
    .refine((data) => !(data.doubleIfEnemyBurning && data.doubleIfEnemyNotBurning), {
      message: "damage effect cannot have both doubleIfEnemyBurning and doubleIfEnemyNotBurning",
    })
    .refine((data) => !(data.doubleIfEnemyNotBurning && data.tripleIfEnemyNotBurning), {
      message: "damage effect cannot have both doubleIfEnemyNotBurning and tripleIfEnemyNotBurning",
    })
    .refine((data) => !(data.detonateAllBurn && data.detonateIfEnemyBurning), {
      message: "damage effect cannot have both detonateAllBurn and detonateIfEnemyBurning",
    }),
} satisfies EffectKindDefinition<"damage">;

const selfDamageEffectDefinition = {
  kind: "self-damage",
  schema: z.object({
    kind: z.literal("self-damage"),
    damageType: EnemyStatusDamageIdSchema,
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"self-damage">;

const randomDamageEffectDefinition = {
  kind: "random-damage",
  schema: z
    .object({
      kind: z.literal("random-damage"),
      minAmount: PositiveAmountSchema,
      maxAmount: PositiveAmountSchema,
      damageTypePool: z.array(DamageTypeSchema).min(2).optional(),
    })
    .refine((data) => data.maxAmount >= data.minAmount, {
      message: "random-damage maxAmount must be >= minAmount",
    }),
} satisfies EffectKindDefinition<"random-damage">;

const removeEnemyArmorEffectDefinition = {
  kind: "remove-enemy-armor",
  schema: z
    .object({
      kind: z.literal("remove-enemy-armor"),
      // Omitted when removeAll is set; old saves may still carry an ignored amount.
      amount: PositiveAmountSchema.optional(),
      removeAll: z.boolean().optional(),
      halve: z.boolean().optional(),
    })
    .refine((data) => data.halve === true || data.removeAll === true || data.amount !== undefined, {
      message: "remove-enemy-armor requires amount, removeAll, or halve",
    })
    .refine((data) => data.halve !== true || (data.removeAll !== true && data.amount === undefined), {
      message: "remove-enemy-armor halve cannot combine with amount or removeAll",
    }),
} satisfies EffectKindDefinition<"remove-enemy-armor">;

export const DAMAGE_EFFECT_DEFINITIONS = [
  damageEffectDefinition,
  selfDamageEffectDefinition,
  randomDamageEffectDefinition,
  removeEnemyArmorEffectDefinition,
] as const;
