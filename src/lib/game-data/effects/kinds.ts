// Canonical battle card effect kind strings — derived from template definitions so adding a
// new effect only requires one registration (its schema definition).
import { TEMPLATE_EFFECT_DEFINITIONS } from "./template-definitions";

export const RECURSIVE_BATTLE_CARD_EFFECT_KINDS = ["chance", "repeat-over-turns"] as const;

type TemplateKind = (typeof TEMPLATE_EFFECT_DEFINITIONS)[number]["kind"];
type RecursiveKind = (typeof RECURSIVE_BATTLE_CARD_EFFECT_KINDS)[number];
export type BattleCardEffectKind = TemplateKind | RecursiveKind;

// Derived single-source list: every template kind + the two recursive kinds.
// Runtime map loses literal inference, so `satisfies` against the union type keeps the derivation checked.
export const BATTLE_CARD_EFFECT_KINDS = [
  ...TEMPLATE_EFFECT_DEFINITIONS.map((def) => def.kind),
  ...RECURSIVE_BATTLE_CARD_EFFECT_KINDS,
] as const satisfies readonly BattleCardEffectKind[];
