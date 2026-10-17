import { z } from "zod";
import { AmountSchema, DamageTypeSchema, EnemyStatusDamageIdSchema, PositiveAmountSchema } from "./shared-schemas";

export const DAMAGE_EFFECT_DEFINITIONS = [
  z
    .strictObject({
      kind: z.literal("damage"),
      damageType: DamageTypeSchema,
      amount: AmountSchema,
      lifesteal: z.boolean().optional(),
      equalToBlock: z.boolean().optional(),
      equalToBlockPercent: z.number().int().min(1).max(100).optional(),
      equalToArmor: z.boolean().optional(),
      forgeBonusPercent: z.number().int().min(1).max(100).optional(),
      ignoreArmor: z.boolean().optional(),
      ignoreBlock: z.boolean().optional(),
      damageTypeIfTargetFrozen: DamageTypeSchema.optional(),
      amountIfTargetFrozen: AmountSchema.optional(),
      doubleIfEnemyBleeding: z.boolean().optional(),
      tripleIfEnemyNotBurning: z.boolean().optional(),
      detonateAllBurn: z.boolean().optional(),
      detonateAllBleed: z.boolean().optional(),
      damageTypePool: z.array(DamageTypeSchema).min(2).optional(),
    })
    .refine((data) => (data.damageTypeIfTargetFrozen === undefined) === (data.amountIfTargetFrozen === undefined), {
      message: "Frozen alternative requires both damage type and amount",
    })
    .refine(
      (data) =>
        !data.damageTypeIfTargetFrozen ||
        !(
          data.damageTypePool !== undefined ||
          data.equalToBlock === true ||
          data.equalToArmor === true ||
          data.forgeBonusPercent !== undefined
        ),
      { message: "Conditional damage cannot combine with another damage selector" },
    )
    .refine((data) => data.equalToBlockPercent === undefined || data.equalToBlock === true, {
      message: "equalToBlockPercent requires equalToBlock",
    })
    .refine(
      (data) =>
        [data.equalToBlock, data.equalToArmor, data.forgeBonusPercent !== undefined].filter(Boolean).length <= 1,
      {
        message: "damage effect must have at most one of equalToBlock/equalToArmor/forgeBonusPercent",
      },
    ),

  z.object({
    kind: z.literal("self-damage"),
    damageType: EnemyStatusDamageIdSchema,
    amount: AmountSchema,
  }),
  z
    .object({
      kind: z.literal("random-damage"),
      minAmount: PositiveAmountSchema,
      lifesteal: z.boolean().optional(),
      maxAmount: PositiveAmountSchema,
      damageTypePool: z.array(DamageTypeSchema).min(2).optional(),
    })
    .refine((data) => data.maxAmount >= data.minAmount, {
      message: "random-damage maxAmount must be >= minAmount",
    }),
  z
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
] as const;
