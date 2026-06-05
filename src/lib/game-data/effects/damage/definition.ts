// Damage effect — template module: kind, Zod schema, and dispatch route in one place.
// Battle handler: @/lib/battle/effect-handlers/damage/apply.ts(see effects/BATTLE_HANDLERS.md)
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";
import { DamageTypeSchema } from "../shared-schemas";

export const damageEffectDefinition = {
  kind: "damage",
  dispatchRoute: "damage",
  schema: z.object({
    kind: z.literal("damage"),
    damageType: DamageTypeSchema,
    amount: z.number().finite(),
    lifesteal: z.boolean().optional(),
    equalToBlock: z.boolean().optional(),
    equalToArmor: z.boolean().optional(),
    equalToGoldPercent: z.number().finite().optional(),
  }),
} satisfies EffectKindDefinition<"damage">;
