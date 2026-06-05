// Battle handler: @/lib/battle/effect-handlers/mana-route.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const gainMaxManaEffectDefinition = {
  kind: "gain-max-mana",
  dispatchRoute: "mana",
  schema: z.object({ kind: z.literal("gain-max-mana"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"gain-max-mana">;
