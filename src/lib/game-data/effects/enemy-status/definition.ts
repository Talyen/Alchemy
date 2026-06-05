// Enemy-status effect — applies stacks on the enemy (labyrinth modifiers use adjustEnemyStatusDelta).
// Battle handler: @/lib/battle/effect-handlers/enemy-status/apply.ts
import { z } from "zod";
import type { EffectKindDefinition } from "../definition";
import { EnemyStatusIdSchema } from "../shared-schemas";

export const enemyStatusEffectDefinition = {
  kind: "enemy-status",
  dispatchRoute: "enemy-status",
  schema: z.object({
    kind: z.literal("enemy-status"),
    status: EnemyStatusIdSchema,
    amount: z.number().finite(),
  }),
} satisfies EffectKindDefinition<"enemy-status">;
