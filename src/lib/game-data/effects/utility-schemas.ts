import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import { AmountSchema } from "./shared-schemas";

export const gainGoldEffectDefinition = {
  kind: "gain-gold",
  schema: z.object({
    kind: z.literal("gain-gold"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"gain-gold">;

export const wishEffectDefinition = {
  kind: "wish",
  schema: z.object({
    kind: z.literal("wish"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"wish">;

export const drawCardsEffectDefinition = {
  kind: "draw-cards",
  schema: z.object({
    kind: z.literal("draw-cards"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"draw-cards">;
