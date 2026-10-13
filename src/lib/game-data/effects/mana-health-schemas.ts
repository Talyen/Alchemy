import { z } from "zod";
import type { EffectKindDefinition } from "./shared-schemas";
import { PositiveAmountSchema, defineAmountEffect } from "./shared-schemas";

export const MANA_HEALTH_EFFECT_DEFINITIONS = [
  {
    kind: "restore-mana",
    schema: z.object({
      kind: z.literal("restore-mana"),
      amount: PositiveAmountSchema,
      ifEnemyFrozen: z.boolean().optional(),
      allowOverflow: z.boolean().optional(),
    }),
  } satisfies EffectKindDefinition<"restore-mana">,
  defineAmountEffect("lose-mana"),
  defineAmountEffect("gain-max-mana"),
  defineAmountEffect("lose-max-mana"),
  defineAmountEffect("heal"),
  defineAmountEffect("lose-health"),
] as const;
