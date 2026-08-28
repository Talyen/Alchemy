import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import { AmountSchema } from "./shared-schemas";

export const restoreManaEffectDefinition = {
  kind: "restore-mana",
  schema: z.object({
    kind: z.literal("restore-mana"),
    amount: AmountSchema,
    ifEnemyFrozen: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"restore-mana">;

export const loseManaEffectDefinition = {
  kind: "lose-mana",
  schema: z.object({
    kind: z.literal("lose-mana"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"lose-mana">;

export const gainMaxManaEffectDefinition = {
  kind: "gain-max-mana",
  schema: z.object({
    kind: z.literal("gain-max-mana"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"gain-max-mana">;

export const loseMaxManaEffectDefinition = {
  kind: "lose-max-mana",
  schema: z.object({
    kind: z.literal("lose-max-mana"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"lose-max-mana">;

export const healEffectDefinition = {
  kind: "heal",
  schema: z.object({
    kind: z.literal("heal"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"heal">;

export const loseHealthEffectDefinition = {
  kind: "lose-health",
  schema: z.object({
    kind: z.literal("lose-health"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"lose-health">;
