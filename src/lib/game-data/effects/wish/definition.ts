// Battle handler: @/lib/battle/effect-handlers/wish/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const wishEffectDefinition = {
  kind: "wish",
  dispatchRoute: "utility",
  schema: z.object({ kind: z.literal("wish"), amount: z.number().finite() }),
} satisfies EffectKindDefinition<"wish">;
