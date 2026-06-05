// Battle handler: @/lib/battle/effect-handlers/lose-max-mana/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const loseMaxManaEffectDefinition = {
  kind: "lose-max-mana",
  dispatchRoute: "mana",
  schema: z.object({ kind: z.literal("lose-max-mana"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"lose-max-mana">;
