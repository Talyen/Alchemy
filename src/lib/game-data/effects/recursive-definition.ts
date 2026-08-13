// Recursive battle effect schemas: chance and repeat-over-turns nest other effects.
import { z } from "zod";
import type { BattleCardEffect } from "../types";

export const chanceEffectDefinition = {
  kind: "chance" as const,
};

export const repeatOverTurnsEffectDefinition = {
  kind: "repeat-over-turns" as const,
};

export function createChanceEffectSchema(getEffectSchema: () => z.ZodType<BattleCardEffect>) {
  return z.object({
    kind: z.literal("chance"),
    probability: z.number(),
    successEffects: z.array(z.lazy(getEffectSchema)),
    failureEffects: z.array(z.lazy(getEffectSchema)),
  });
}

export function createRepeatOverTurnsEffectSchema(getEffectSchema: () => z.ZodType<BattleCardEffect>) {
  return z.object({
    kind: z.literal("repeat-over-turns"),
    remainingTurns: z.number(),
    effects: z.array(z.lazy(getEffectSchema)),
  });
}
