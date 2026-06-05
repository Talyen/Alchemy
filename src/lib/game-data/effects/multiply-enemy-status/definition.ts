// Battle handler: @/lib/battle/effect-handlers/multiply-enemy-status/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";
import { EnemyStatusIdSchema } from "../shared-schemas";

export const multiplyEnemyStatusEffectDefinition = {
  kind: "multiply-enemy-status",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("multiply-enemy-status"),
    status: EnemyStatusIdSchema,
    factor: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"multiply-enemy-status">;
