// Battle handler: @/lib/battle/effect-handlers/utility-route.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const loseHealthEffectDefinition = {
  kind: "lose-health",
  dispatchRoute: "utility",
  schema: z.object({ kind: z.literal("lose-health"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"lose-health">;
