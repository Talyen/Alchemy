// Utility and card manipulation card effect schemas and metadata.
import { z } from "zod";
import type { EffectKindDefinition } from "./definition";

export const gainGoldEffectDefinition = {
  kind: "gain-gold",
  schema: z.object({
    kind: z.literal("gain-gold"),
    amount: z.number().int().min(0).max(999),
  }),
} satisfies EffectKindDefinition<"gain-gold">;

export const wishEffectDefinition = {
  kind: "wish",
  schema: z.object({
    kind: z.literal("wish"),
    amount: z.number().int().min(0).max(999),
  }),
} satisfies EffectKindDefinition<"wish">;

export const drawCardsEffectDefinition = {
  kind: "draw-cards",
  schema: z.object({
    kind: z.literal("draw-cards"),
    amount: z.number().int().min(0).max(999),
  }),
} satisfies EffectKindDefinition<"draw-cards">;
