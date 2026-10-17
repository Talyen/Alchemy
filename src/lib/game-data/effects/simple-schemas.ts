import { z } from "zod";
import {
  CompanionIdSchema,
  PositiveAmountSchema,
  defineAmountEffect,
  defineFlagEffect,
  defineRangedEffect,
} from "./shared-schemas";

export const SIMPLE_EFFECT_DEFINITIONS = [
  z.object({
    kind: z.literal("summon-companion"),
    companionId: CompanionIdSchema,
  }),
  defineAmountEffect("companion-action"),
  defineRangedEffect("random-draw"),
  z.object({
    kind: z.literal("gain-gold"),
    amount: PositiveAmountSchema,
    ifEnemyStunned: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("wish"),
    amount: PositiveAmountSchema,
    companionIfAbsent: z.boolean().optional(),
  }),
  defineAmountEffect("draw-cards"),
  defineFlagEffect("next-hit-crit"),
  defineFlagEffect("next-hit-leech"),
  defineFlagEffect("play-next-card-twice"),
  defineFlagEffect("next-hit-poison"),
  defineFlagEffect("next-archery-free"),
  defineFlagEffect("dodge-next-attack"),
] as const;
