// Battle handler: @/lib/battle/effect-handlers/heal-effect.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const healEffectDefinition = {
  kind: "heal",
  dispatchRoute: "heal",
  schema: z.object({ kind: z.literal("heal"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"heal">;
