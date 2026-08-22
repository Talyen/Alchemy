// Composes BattleCardEffectSchema from per-kind definition modules.
import { z } from "zod";
import type { BattleCardEffect } from "../types";
import { createChanceEffectSchema, createRepeatOverTurnsEffectSchema } from "./recursive-definition";
import { TEMPLATE_EFFECT_DEFINITIONS } from "./template-definitions";

type DiscriminableKindSchema = z.core.$ZodTypeDiscriminable<"kind">;

function getTemplateEffectSchemas(): [DiscriminableKindSchema, ...DiscriminableKindSchema[]] {
  const [firstTemplateEffectDefinition, ...remainingTemplateEffectDefinitions] = TEMPLATE_EFFECT_DEFINITIONS;
  return [firstTemplateEffectDefinition.schema, ...remainingTemplateEffectDefinitions.map((def) => def.schema)];
}

const templateEffectSchemas = getTemplateEffectSchemas();

const BattleCardEffectSchemaBase = z.discriminatedUnion("kind", templateEffectSchemas);

export const BattleCardEffectSchema: z.ZodType<BattleCardEffect> = z.lazy(() => {
  const ChanceEffectSchema = createChanceEffectSchema(() => BattleCardEffectSchema);
  const RepeatOverTurnsEffectSchema = createRepeatOverTurnsEffectSchema(() => BattleCardEffectSchema);
  return z.union([BattleCardEffectSchemaBase, ChanceEffectSchema, RepeatOverTurnsEffectSchema]);
}) as z.ZodType<BattleCardEffect>;
