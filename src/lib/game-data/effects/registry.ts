import { z } from "zod";
import type { BattleCardEffect } from "../types";
import { DAMAGE_EFFECT_DEFINITIONS } from "./damage-schemas";
import { MANA_HEALTH_EFFECT_DEFINITIONS } from "./mana-health-schemas";
import { SIMPLE_EFFECT_DEFINITIONS } from "./simple-schemas";
import { STATUS_EFFECT_DEFINITIONS } from "./status-schemas";

export const TEMPLATE_EFFECT_DEFINITIONS = [
  ...DAMAGE_EFFECT_DEFINITIONS,
  ...STATUS_EFFECT_DEFINITIONS,
  ...MANA_HEALTH_EFFECT_DEFINITIONS,
  ...SIMPLE_EFFECT_DEFINITIONS,
] as const;

if (
  new Set(TEMPLATE_EFFECT_DEFINITIONS.map((definition) => definition.kind)).size !== TEMPLATE_EFFECT_DEFINITIONS.length
) {
  throw new Error("Duplicate card effect schema kind");
}

export const RECURSIVE_BATTLE_CARD_EFFECT_KINDS = ["chance", "repeat-over-turns"] as const;

type TemplateKind = (typeof TEMPLATE_EFFECT_DEFINITIONS)[number]["kind"];
type RecursiveKind = (typeof RECURSIVE_BATTLE_CARD_EFFECT_KINDS)[number];
export type BattleCardEffectKind = TemplateKind | RecursiveKind;

const RECURSIVE_KIND_SET: ReadonlySet<string> = new Set(RECURSIVE_BATTLE_CARD_EFFECT_KINDS);

export function isRecursiveBattleCardEffectKind(kind: string): kind is RecursiveKind {
  return RECURSIVE_KIND_SET.has(kind);
}

export const BATTLE_CARD_EFFECT_KINDS = [
  ...TEMPLATE_EFFECT_DEFINITIONS.map((def) => def.kind),
  ...RECURSIVE_BATTLE_CARD_EFFECT_KINDS,
] as const satisfies readonly BattleCardEffectKind[];

function createChanceEffectSchema(getEffectSchema: () => z.ZodType<BattleCardEffect>) {
  return z.object({
    kind: z.literal("chance"),
    probability: z.number().min(0).max(1),
    successEffects: z.array(z.lazy(getEffectSchema)).min(1),
    // Empty failureEffects means "no effect on failure" — the sanctioned shape
    // for a bonus-trigger chance (bonded Mana Moth / Library Owl synthesize it
    // at runtime). Authored cards keep non-empty branches via content validation.
    failureEffects: z.array(z.lazy(getEffectSchema)),
  });
}

function createRepeatOverTurnsEffectSchema(getEffectSchema: () => z.ZodType<BattleCardEffect>) {
  return z.object({
    kind: z.literal("repeat-over-turns"),
    remainingTurns: z.number().int().min(1).max(10),
    effects: z.array(z.lazy(getEffectSchema)),
  });
}

type DiscriminableKindSchema = z.core.$ZodTypeDiscriminable<"kind">;

function getTemplateEffectSchemas(): [DiscriminableKindSchema, ...DiscriminableKindSchema[]] {
  const [first, ...rest] = TEMPLATE_EFFECT_DEFINITIONS;
  return [first.schema, ...rest.map((def) => def.schema)];
}

const templateEffectSchemas = getTemplateEffectSchemas();
const BattleCardEffectSchemaBase = z.discriminatedUnion("kind", templateEffectSchemas);

export const BattleCardEffectSchema: z.ZodType<BattleCardEffect> = z.lazy(() => {
  const ChanceEffectSchema = createChanceEffectSchema(() => BattleCardEffectSchema);
  const RepeatOverTurnsEffectSchema = createRepeatOverTurnsEffectSchema(() => BattleCardEffectSchema);
  return z.union([BattleCardEffectSchemaBase, ChanceEffectSchema, RepeatOverTurnsEffectSchema]);
}) as z.ZodType<BattleCardEffect>;
