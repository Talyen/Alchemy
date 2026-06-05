// Battle handler: @/lib/battle/effect-handlers/restore-mana/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const restoreManaEffectDefinition = {
  kind: "restore-mana",
  dispatchRoute: "mana",
  schema: z.object({ kind: z.literal("restore-mana"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"restore-mana">;
