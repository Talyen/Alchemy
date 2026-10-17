import { z } from "zod";
import { AmountSchema, DamageTypeSchema, EnemyStatusDamageIdSchema, PositiveAmountSchema } from "./shared-schemas";

export const STATUS_EFFECT_DEFINITIONS = [
  z
    .object({
      kind: z.literal("player-status"),
      status: z.enum(["block", "armor", "thorns", "forge", "haste", "phoenixFeather"]),
      amount: AmountSchema,
      forgeAmount: AmountSchema.optional(),
      statusPool: z
        .array(z.enum(["block", "armor", "thorns", "forge"]))
        .min(2)
        .optional(),
      perManaCrystal: AmountSchema.optional(),
      convertCurrentMana: z.number().int().min(0).max(100).optional(),
    })
    .refine(
      (data) =>
        data.forgeAmount === undefined ||
        (data.statusPool?.length === 3 &&
          data.statusPool.includes("forge") &&
          data.statusPool.includes("block") &&
          data.statusPool.includes("armor") &&
          data.statusPool.every((status) => status === "block" || status === "forge" || status === "armor") &&
          data.perManaCrystal === undefined &&
          data.convertCurrentMana === undefined),
      { message: "forgeAmount requires a Block/Forge/Armor pool without Mana conversion" },
    )
    .refine((data) => !(data.perManaCrystal !== undefined && data.convertCurrentMana !== undefined), {
      message: "player-status cannot have both perManaCrystal and convertCurrentMana",
    }),
  z
    .object({
      kind: z.literal("remove-harmful-status"),
      // Omitted when removeAll is set; old saves may still carry an ignored amount.
      amount: PositiveAmountSchema.optional(),
      removeAll: z.boolean().optional(),
    })
    .refine((data) => data.removeAll === true || data.amount !== undefined, {
      message: "remove-harmful-status requires amount unless removeAll is set",
    }),
  z.object({
    kind: z.literal("remove-player-status"),
    status: EnemyStatusDamageIdSchema,
  }),
  z.object({
    kind: z.literal("multiply-enemy-status"),
    status: EnemyStatusDamageIdSchema,
    factor: z.number().int().min(1).max(10),
  }),
  z.object({
    kind: z.literal("cleanse-player-status-to-damage"),
    status: z.literal("burn"),
    damageType: DamageTypeSchema,
    lifesteal: z.boolean().optional(),
  }),
] as const;
