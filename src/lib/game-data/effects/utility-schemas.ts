// Utility and card manipulation card effect schemas and metadata.
import { z } from "zod";
import type { EffectKindDefinition } from "./definition";

export const gainGoldEffectDefinition = {
  kind: "gain-gold",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("gain-gold"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"gain-gold">;

export const wishEffectDefinition = {
  kind: "wish",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("wish"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"wish">;

export const drawCardsEffectDefinition = {
  kind: "draw-cards",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("draw-cards"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"draw-cards">;
