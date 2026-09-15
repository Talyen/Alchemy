import { applyCardEffects } from "./effect-handlers";
import { resolveCompanionTurnStart } from "./companion-effects";
import type { BattleState, CombatTextEvent } from "./types";

// Thin binder, kept separate on purpose: binding applyCardEffects here keeps
// companion-effects free of an import back into effect-handlers/registry
// (which already imports resolveCompanionTurnStart), avoiding a module cycle.
export function processCompanionTurnStart(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { damageOnly?: boolean },
) {
  return resolveCompanionTurnStart(state, combatTexts, applyCardEffects, options);
}
