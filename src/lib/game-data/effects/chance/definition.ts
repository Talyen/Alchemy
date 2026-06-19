// Battle handler: routed recursively in @/lib/battle/effect-handlers/dispatch.ts.
import { z } from "zod";
import type { BattleCardEffect } from "../../types";

export const chanceEffectDefinition = {
  kind: "chance" as const,
};

export function createChanceEffectSchema(getEffectSchema: () => z.ZodType<BattleCardEffect>) {
  return z.object({
    kind: z.literal("chance"),
    probability: z.number(),
    successEffects: z.array(z.lazy(getEffectSchema)),
    failureEffects: z.array(z.lazy(getEffectSchema)),
  });
}
