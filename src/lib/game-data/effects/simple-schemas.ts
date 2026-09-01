import { z } from "zod";
import type { EffectKindDefinition } from "./registry";
import { CompanionIdSchema, PositiveAmountSchema } from "./shared-schemas";

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
    amount: PositiveAmountSchema,
  }),
} satisfies EffectKindDefinition<"buff-companion">;

export const gainGoldEffectDefinition = {
  kind: "gain-gold",
  schema: z.object({
    kind: z.literal("gain-gold"),
    amount: PositiveAmountSchema,
  }),
} satisfies EffectKindDefinition<"gain-gold">;

export const wishEffectDefinition = {
  kind: "wish",
  schema: z.object({
    kind: z.literal("wish"),
    amount: PositiveAmountSchema,
  }),
} satisfies EffectKindDefinition<"wish">;

export const drawCardsEffectDefinition = {
  kind: "draw-cards",
  schema: z.object({
    kind: z.literal("draw-cards"),
    amount: PositiveAmountSchema,
  }),
} satisfies EffectKindDefinition<"draw-cards">;

export const nextHitCritEffectDefinition = {
  kind: "next-hit-crit",
  schema: z.object({ kind: z.literal("next-hit-crit") }),
} satisfies EffectKindDefinition<"next-hit-crit">;

export const playNextCardTwiceEffectDefinition = {
  kind: "play-next-card-twice",
  schema: z.object({ kind: z.literal("play-next-card-twice") }),
} satisfies EffectKindDefinition<"play-next-card-twice">;

export const nextHitPoisonEffectDefinition = {
  kind: "next-hit-poison",
  schema: z.object({ kind: z.literal("next-hit-poison") }),
} satisfies EffectKindDefinition<"next-hit-poison">;
