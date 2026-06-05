// Battle handler: @/lib/battle/effect-handlers/self-damage/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";
import { EnemyStatusIdSchema } from "../shared-schemas";

export const selfDamageEffectDefinition = {
  kind: "self-damage",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("self-damage"),
    damageType: EnemyStatusIdSchema,
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"self-damage">;
