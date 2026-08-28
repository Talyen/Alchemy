import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import { AmountSchema, CompanionIdSchema } from "./shared-schemas";

export const summonCompanionEffectDefinition = {
  kind: "summon-companion",
  schema: z.object({
    kind: z.literal("summon-companion"),
    companionId: CompanionIdSchema,
  }),
} satisfies EffectKindDefinition<"summon-companion">;

export const buffCompanionEffectDefinition = {
  kind: "buff-companion",
  schema: z.object({
    kind: z.literal("buff-companion"),
    amount: AmountSchema,
  }),
} satisfies EffectKindDefinition<"buff-companion">;
