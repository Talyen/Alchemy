import { applyCardEffects } from "./effect-handlers";
import { resolveCompanionTurnStart } from "./companion-effects";
import type { BattleState, CombatTextEvent } from "./types";
import { applyEmergencyWishForEmptyDraw } from "./wish";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";

// Thin binder, kept separate on purpose: binding applyCardEffects here keeps
// companion-effects free of an import back into effect-handlers/registry
// (which already imports resolveCompanionTurnStart), avoiding a module cycle.
export function processCompanionTurnStart(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { damageOnly?: boolean },
) {
  const previousEmptyDraw = state.onEmptyDraw;
  const scoped: BattleState = {
    ...state,
    onEmptyDraw:
      previousEmptyDraw ??
      ((current, amount, texts) =>
        resolvePendingBattleReactions(applyEmergencyWishForEmptyDraw(current, amount, texts), texts)),
  };
  const resolved = resolveCompanionTurnStart(scoped, combatTexts, applyCardEffects, options);
  if (resolved === scoped) return state;
  if (previousEmptyDraw) return resolved;
  const { onEmptyDraw: _onEmptyDraw, ...completed } = resolved;
  return completed;
}
