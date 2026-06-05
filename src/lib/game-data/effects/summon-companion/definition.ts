// Battle handler: @/lib/battle/effect-handlers/utility-route.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";
import { CompanionIdSchema } from "../shared-schemas";

export const summonCompanionEffectDefinition = {
  kind: "summon-companion",
  dispatchRoute: "utility",
  schema: z.object({
    kind: z.literal("summon-companion"),
    companionId: CompanionIdSchema,
  }),
} satisfies EffectKindDefinition<"summon-companion">;
