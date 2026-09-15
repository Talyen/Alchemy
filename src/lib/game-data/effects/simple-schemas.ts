import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import {
  CompanionIdSchema,
  PositiveAmountSchema,
  defineAmountEffect,
  defineFlagEffect,
  defineRangedEffect,
} from "./shared-schemas";

export const summonCompanionEffectDefinition = {
  kind: "summon-companion",
  schema: z.object({
    kind: z.literal("summon-companion"),
    companionId: CompanionIdSchema,
  }),
} satisfies EffectKindDefinition<"summon-companion">;

export const buffCompanionEffectDefinition = defineAmountEffect(
  "buff-companion",
) satisfies EffectKindDefinition<"buff-companion">;

export const gainGoldEffectDefinition = {
  kind: "gain-gold",
  schema: z.object({
    kind: z.literal("gain-gold"),
    amount: PositiveAmountSchema,
    ifEnemyStunned: z.boolean().optional(),
  }),
} satisfies EffectKindDefinition<"gain-gold">;

export const companionActionEffectDefinition = defineAmountEffect(
  "companion-action",
) satisfies EffectKindDefinition<"companion-action">;

export const randomDrawEffectDefinition = defineRangedEffect(
  "random-draw",
) satisfies EffectKindDefinition<"random-draw">;

export const wishEffectDefinition = defineAmountEffect("wish") satisfies EffectKindDefinition<"wish">;

export const drawCardsEffectDefinition = defineAmountEffect("draw-cards") satisfies EffectKindDefinition<"draw-cards">;

export const nextHitCritEffectDefinition = defineFlagEffect(
  "next-hit-crit",
) satisfies EffectKindDefinition<"next-hit-crit">;

export const nextHitLeechEffectDefinition = defineFlagEffect(
  "next-hit-leech",
) satisfies EffectKindDefinition<"next-hit-leech">;

export const playNextCardTwiceEffectDefinition = defineFlagEffect(
  "play-next-card-twice",
) satisfies EffectKindDefinition<"play-next-card-twice">;

export const nextHitPoisonEffectDefinition = defineFlagEffect(
  "next-hit-poison",
) satisfies EffectKindDefinition<"next-hit-poison">;

export const nextArcheryFreeEffectDefinition = defineFlagEffect(
  "next-archery-free",
) satisfies EffectKindDefinition<"next-archery-free">;
