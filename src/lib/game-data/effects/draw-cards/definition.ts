// Battle handler: @/lib/battle/effect-handlers/utility-route.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const drawCardsEffectDefinition = {
  kind: "draw-cards",
  dispatchRoute: "utility",
  schema: z.object({ kind: z.literal("draw-cards"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"draw-cards">;
