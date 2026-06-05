import { z } from "zod";
import type { EffectKindDefinition } from "../definition";
import { DamageTypeSchema } from "../shared-schemas";

export const cleansePlayerStatusToDamageEffectDefinition = {
  kind: "cleanse-player-status-to-damage",
  dispatchRoute: "cleanse-player-status-to-damage",
  schema: z.object({
    kind: z.literal("cleanse-player-status-to-damage"),
    status: z.literal("burn"),
    damageType: DamageTypeSchema,
    removeAll: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"cleanse-player-status-to-damage">;
