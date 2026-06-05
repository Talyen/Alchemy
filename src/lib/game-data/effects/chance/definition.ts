// Battle handler: @/lib/battle/effect-handlers/chance/apply.ts
import { z } from "zod";
import type { BattleCardEffect } from "../../types";
import type { EffectDispatchRoute } from "../dispatch-routes";

export const chanceEffectDefinition = {
  kind: "chance" as const,
  dispatchRoute: "chance" as const satisfies EffectDispatchRoute,
};

export function createChanceEffectSchema(getEffectSchema: () => z.ZodType<BattleCardEffect>) {
  return z.object({
    kind: z.literal("chance"),
    probability: z.number().finite(),
    successEffects: z.array(z.lazy(getEffectSchema)),
    failureEffects: z.array(z.lazy(getEffectSchema)),
  });
}
