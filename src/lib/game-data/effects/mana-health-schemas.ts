import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import { PositiveAmountSchema, defineAmountEffect } from "./shared-schemas";

export const restoreManaEffectDefinition = {
  kind: "restore-mana",
  schema: z.object({
    kind: z.literal("restore-mana"),
    amount: PositiveAmountSchema,
    ifEnemyFrozen: z.boolean().optional(),
    allowOverflow: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"restore-mana">;

export const loseManaEffectDefinition = defineAmountEffect("lose-mana") satisfies EffectKindDefinition<"lose-mana">;

export const gainMaxManaEffectDefinition = defineAmountEffect(
  "gain-max-mana",
) satisfies EffectKindDefinition<"gain-max-mana">;

export const loseMaxManaEffectDefinition = defineAmountEffect(
  "lose-max-mana",
) satisfies EffectKindDefinition<"lose-max-mana">;

export const healEffectDefinition = defineAmountEffect("heal") satisfies EffectKindDefinition<"heal">;

export const loseHealthEffectDefinition = defineAmountEffect(
  "lose-health",
) satisfies EffectKindDefinition<"lose-health">;
