// Gain-gold effect — utility dispatch route.
// Battle handler: @/lib/battle/effect-handlers/utility-route.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const gainGoldEffectDefinition = {
  kind: "gain-gold",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("gain-gold"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"gain-gold">;
