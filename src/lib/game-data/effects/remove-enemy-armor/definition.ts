// Battle handler: @/lib/battle/effect-handlers/remove-enemy-armor/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const removeEnemyArmorEffectDefinition = {
  kind: "remove-enemy-armor",
  dispatchRoute: "utility",
  schema: z.object({ kind: z.literal("remove-enemy-armor"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"remove-enemy-armor">;
