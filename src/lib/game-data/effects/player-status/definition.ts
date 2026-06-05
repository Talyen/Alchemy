// Battle handler: @/lib/battle/effect-handlers/player-status/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";

export const playerStatusEffectDefinition = {
  kind: "player-status",
  dispatchRoute: "player-status",
  schema: z.object({
    kind: z.literal("player-status"),
    status: z.enum(["block", "armor", "forge", "haste", "phoenixFeather"]),
    amount: z.number().finite(),
    perManaCrystal: z.number().finite().optional(),
  }),
} satisfies EffectKindDefinition<"player-status">;
