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

const [firstTemplate, ...restTemplates] = TEMPLATE_EFFECT_DEFINITIONS;
const templateEffectSchema = z.discriminatedUnion("kind", [
  firstTemplate.schema,
  ...restTemplates.map((definition) => definition.schema),
]);

// Only the child arrays need lazy resolution; build each recursive schema once.
// Zod permits explicit undefined for optional fields; the authored effect type
// uses exact optional properties, so retain that narrowing at the schema boundary.
export const BattleCardEffectSchema: z.ZodType<BattleCardEffect> = z.union([
  templateEffectSchema,
  z.object({
    kind: z.literal("chance"),
    probability: z.number().min(0).max(1),
    successEffects: z.array(z.lazy(() => BattleCardEffectSchema)).min(1),
    // Synthesized runtime bonuses may do nothing on failure. Content validation
    // requires non-empty failure branches on authored cards.
    failureEffects: z.array(z.lazy(() => BattleCardEffectSchema)),
  }),
  z.object({
    kind: z.literal("repeat-over-turns"),
    remainingTurns: z.number().int().min(1).max(10),
    effects: z.array(z.lazy(() => BattleCardEffectSchema)),
  }),
]) as z.ZodType<BattleCardEffect>;
