// Companion-related card effect schemas and metadata.
import { z } from "zod";
import type { EffectKindDefinition } from "./definition";
import { CompanionIdSchema } from "./shared-schemas";

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
    amount: z.number().int().min(0).max(999),
  }),
} satisfies EffectKindDefinition<"buff-companion">;
