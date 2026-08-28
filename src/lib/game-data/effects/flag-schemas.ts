// One-shot combat flag card effect schemas.
import { z } from "zod";
import type { EffectKindDefinition } from "./registry";

export const nextHitCritEffectDefinition = {
  kind: "next-hit-crit",
  schema: z.object({
    kind: z.literal("next-hit-crit"),
  }),
} satisfies EffectKindDefinition<"next-hit-crit">;

export const playNextCardTwiceEffectDefinition = {
  kind: "play-next-card-twice",
  schema: z.object({
    kind: z.literal("play-next-card-twice"),
  }),
} satisfies EffectKindDefinition<"play-next-card-twice">;

export const nextHitPoisonEffectDefinition = {
  kind: "next-hit-poison",
  schema: z.object({
    kind: z.literal("next-hit-poison"),
  }),
} satisfies EffectKindDefinition<"next-hit-poison">;
