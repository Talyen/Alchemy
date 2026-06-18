// Mana and Health related card effect schemas and metadata.
import { z } from "zod";
import type { EffectKindDefinition } from "./definition";

export const restoreManaEffectDefinition = {
  kind: "restore-mana",
  schema: z.object({
    kind: z.literal("restore-mana"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"restore-mana">;

export const loseManaEffectDefinition = {
  kind: "lose-mana",
  schema: z.object({
    kind: z.literal("lose-mana"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"lose-mana">;

export const gainMaxManaEffectDefinition = {
  kind: "gain-max-mana",
  schema: z.object({
    kind: z.literal("gain-max-mana"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"gain-max-mana">;

export const loseMaxManaEffectDefinition = {
  kind: "lose-max-mana",
  schema: z.object({
    kind: z.literal("lose-max-mana"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"lose-max-mana">;

export const healEffectDefinition = {
  kind: "heal",
  schema: z.object({
    kind: z.literal("heal"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"heal">;

export const loseHealthEffectDefinition = {
  kind: "lose-health",
  schema: z.object({
    kind: z.literal("lose-health"),
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"lose-health">;
