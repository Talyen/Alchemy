// Battle handler: @/lib/battle/effect-handlers/mana-route.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const loseManaEffectDefinition = {
  kind: "lose-mana",
  dispatchRoute: "mana",
  schema: z.object({ kind: z.literal("lose-mana"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"lose-mana">;
