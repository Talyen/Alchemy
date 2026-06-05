// Battle handler: @/lib/battle/effect-handlers/random-damage/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const randomDamageEffectDefinition = {
  kind: "random-damage",
  dispatchRoute: "random-damage",
  schema: z.object({
    kind: z.literal("random-damage"),
    minAmount: z.number().finite(),
    maxAmount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"random-damage">;
