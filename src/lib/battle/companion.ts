import { applyCardEffects } from "./effect-handlers";
import { resolveCompanionTurnStart } from "./companion-effects";
import type { BattleState, CombatTextEvent } from "./types";
import { applyEmergencyWishForEmptyDraw } from "./wish";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { resolveSecondaryAction } from "./action-context";
import type { BattleCard } from "@/lib/game-data";

export { createCompanionActionCard } from "./companion-scaling";

/** Inspect the action's own effects in its normal scope, excluding separate post-action rewards. */
export function resolveInspectedCompanionAction(state: BattleState, card: BattleCard): BattleState {
  return resolveSecondaryAction(state, "companion", (scoped) =>
    applyCardEffects(scoped, card, [], {
      origin: "companion",
      manaAtStart: scoped.mana,
      companionAttackBonus: { amount: scoped.flags.companionNextAttackBonus },
      // Primary here lets the detached observer read this action's grants;
      // live Companion feedback retains its ordinary secondary styling.
      feedback: "primary",
    }),
  );
}

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
