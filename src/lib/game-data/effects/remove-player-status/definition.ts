// Battle handler: @/lib/battle/effect-handlers/remove-player-status/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";
import { EnemyStatusIdSchema } from "../shared-schemas";

export const removePlayerStatusEffectDefinition = {
  kind: "remove-player-status",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("remove-player-status"),
    status: EnemyStatusIdSchema,
  }),
} satisfies EffectKindDefinition<"remove-player-status">;
