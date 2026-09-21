import { z } from "zod";
import type { EffectKindDefinition } from "./shared-schemas";
import { PositiveAmountSchema, defineAmountEffect } from "./shared-schemas";

const restoreManaEffectDefinition = {
  kind: "restore-mana",
  schema: z.object({
    kind: z.literal("restore-mana"),
    amount: PositiveAmountSchema,
    ifEnemyFrozen: z.boolean().optional(),
    allowOverflow: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"restore-mana">;

const loseManaEffectDefinition = defineAmountEffect("lose-mana") satisfies EffectKindDefinition<"lose-mana">;

const gainMaxManaEffectDefinition = defineAmountEffect("gain-max-mana") satisfies EffectKindDefinition<"gain-max-mana">;

const loseMaxManaEffectDefinition = defineAmountEffect("lose-max-mana") satisfies EffectKindDefinition<"lose-max-mana">;

const healEffectDefinition = defineAmountEffect("heal") satisfies EffectKindDefinition<"heal">;

const loseHealthEffectDefinition = defineAmountEffect("lose-health") satisfies EffectKindDefinition<"lose-health">;

export const MANA_HEALTH_EFFECT_DEFINITIONS = [
  restoreManaEffectDefinition,
  loseManaEffectDefinition,
  gainMaxManaEffectDefinition,
  loseMaxManaEffectDefinition,
  healEffectDefinition,
  loseHealthEffectDefinition,
] as const;
