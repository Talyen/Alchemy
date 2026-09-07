import { applyCardEffects } from "./effect-handlers";
import { resolveCompanionTurnStart } from "./companion-effects";
import type { BattleState, CombatTextEvent } from "./types";

export function processCompanionTurnStart(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { damageOnly?: boolean },
) {
  return resolveCompanionTurnStart(state, combatTexts, applyCardEffects, options);
}
