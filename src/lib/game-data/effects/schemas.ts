// Composes BattleCardEffectSchema from per-kind definition modules.
import { z } from "zod";
import type { BattleCardEffect } from "../types";
import { chanceEffectDefinition, createChanceEffectSchema } from "./chance/definition";
import { TEMPLATE_EFFECT_DEFINITIONS } from "./template-definitions";

const templateEffectSchemas = TEMPLATE_EFFECT_DEFINITIONS.map((def) => def.schema);

const BattleCardEffectSchemaBase = z.discriminatedUnion(
  "kind",
  // Zod discriminatedUnion requires a non-empty tuple; the array is known to be non-empty at init.
  // TS prevents direct array→tuple coercion without the `unknown` hop.
  templateEffectSchemas as unknown as [z.ZodObject<{ kind: z.ZodType }>, ...Array<z.ZodObject<{ kind: z.ZodType }>>],
);

export const BattleCardEffectSchema: z.ZodType<BattleCardEffect> = z.lazy(() => {
  const ChanceEffectSchema = createChanceEffectSchema(() => BattleCardEffectSchema);
  void chanceEffectDefinition;
  return z.union([BattleCardEffectSchemaBase, ChanceEffectSchema]);
}) as z.ZodType<BattleCardEffect>;
