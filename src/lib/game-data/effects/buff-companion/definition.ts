// Battle handler: @/lib/battle/effect-handlers/utility-route.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const buffCompanionEffectDefinition = {
  kind: "buff-companion",
  dispatchRoute: "utility",
  schema: z.object({ kind: z.literal("buff-companion"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"buff-companion">;
