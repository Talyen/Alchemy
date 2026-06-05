// Battle handler: @/lib/battle/effect-handlers/remove-harmful-status/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const removeHarmfulStatusEffectDefinition = {
  kind: "remove-harmful-status",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("remove-harmful-status"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"remove-harmful-status">;
