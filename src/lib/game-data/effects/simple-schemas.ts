import { z } from "zod";
import type { EffectKindDefinition } from "./shared-schemas";
import {
  CompanionIdSchema,
  PositiveAmountSchema,
  defineAmountEffect,
  defineFlagEffect,
  defineRangedEffect,
} from "./shared-schemas";

export const SIMPLE_EFFECT_DEFINITIONS = [
  {
    kind: "summon-companion",
    schema: z.object({
      kind: z.literal("summon-companion"),
      companionId: CompanionIdSchema,
    }),
  } satisfies EffectKindDefinition<"summon-companion">,
  defineAmountEffect("buff-companion"),
  defineAmountEffect("companion-action"),
  defineRangedEffect("random-draw"),
  {
    kind: "gain-gold",
    schema: z.object({
      kind: z.literal("gain-gold"),
      amount: PositiveAmountSchema,
      ifEnemyStunned: z.boolean().optional(),
    }),
  } satisfies EffectKindDefinition<"gain-gold">,
  {
    kind: "wish",
    schema: z.object({
      kind: z.literal("wish"),
      amount: PositiveAmountSchema,
      companionIfAbsent: z.boolean().optional(),
    }),
  } satisfies EffectKindDefinition<"wish">,
  defineAmountEffect("draw-cards"),
  defineFlagEffect("next-hit-crit"),
  defineFlagEffect("next-hit-leech"),
  defineFlagEffect("play-next-card-twice"),
  defineFlagEffect("next-hit-poison"),
  defineFlagEffect("next-archery-free"),
  defineFlagEffect("dodge-next-attack"),
] as const;
