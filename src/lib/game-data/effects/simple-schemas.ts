import { z } from "zod";
import type { EffectKindDefinition } from "./shared-schemas";
import {
  CompanionIdSchema,
  PositiveAmountSchema,
  defineAmountEffect,
  defineFlagEffect,
  defineRangedEffect,
} from "./shared-schemas";

const summonCompanionEffectDefinition = {
  kind: "summon-companion",
  schema: z.object({
    kind: z.literal("summon-companion"),
    companionId: CompanionIdSchema,
  }),
} satisfies EffectKindDefinition<"summon-companion">;

const buffCompanionEffectDefinition = defineAmountEffect(
  "buff-companion",
) satisfies EffectKindDefinition<"buff-companion">;

const gainGoldEffectDefinition = {
  kind: "gain-gold",
  schema: z.object({
    kind: z.literal("gain-gold"),
    amount: PositiveAmountSchema,
    ifEnemyStunned: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"gain-gold">;

const companionActionEffectDefinition = defineAmountEffect(
  "companion-action",
) satisfies EffectKindDefinition<"companion-action">;

const randomDrawEffectDefinition = defineRangedEffect("random-draw") satisfies EffectKindDefinition<"random-draw">;

const wishEffectDefinition = {
  kind: "wish",
  schema: z.object({
    kind: z.literal("wish"),
    amount: PositiveAmountSchema,
    companionIfAbsent: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"wish">;

const drawCardsEffectDefinition = defineAmountEffect("draw-cards") satisfies EffectKindDefinition<"draw-cards">;

const nextHitCritEffectDefinition = defineFlagEffect("next-hit-crit") satisfies EffectKindDefinition<"next-hit-crit">;

const nextHitLeechEffectDefinition = defineFlagEffect(
  "next-hit-leech",
) satisfies EffectKindDefinition<"next-hit-leech">;

const playNextCardTwiceEffectDefinition = defineFlagEffect(
  "play-next-card-twice",
) satisfies EffectKindDefinition<"play-next-card-twice">;

const nextHitPoisonEffectDefinition = defineFlagEffect(
  "next-hit-poison",
) satisfies EffectKindDefinition<"next-hit-poison">;

const nextArcheryFreeEffectDefinition = defineFlagEffect(
  "next-archery-free",
) satisfies EffectKindDefinition<"next-archery-free">;

export const SIMPLE_EFFECT_DEFINITIONS = [
  summonCompanionEffectDefinition,
  buffCompanionEffectDefinition,
  companionActionEffectDefinition,
  randomDrawEffectDefinition,
  gainGoldEffectDefinition,
  wishEffectDefinition,
  drawCardsEffectDefinition,
  nextHitCritEffectDefinition,
  nextHitLeechEffectDefinition,
  playNextCardTwiceEffectDefinition,
  nextHitPoisonEffectDefinition,
  nextArcheryFreeEffectDefinition,
] as const;
