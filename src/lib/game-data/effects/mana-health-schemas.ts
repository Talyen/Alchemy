import { z } from "zod";
import { PositiveAmountSchema, defineAmountEffect } from "./shared-schemas";

export const MANA_HEALTH_EFFECT_DEFINITIONS = [
  z.strictObject({
    kind: z.literal("restore-mana"),
    amount: PositiveAmountSchema,
    allowOverflow: z.boolean().optional(),
  }),
  defineAmountEffect("lose-mana"),
  defineAmountEffect("gain-max-mana"),
  defineAmountEffect("lose-max-mana"),
  defineAmountEffect("heal"),
  defineAmountEffect("lose-health"),
] as const;
