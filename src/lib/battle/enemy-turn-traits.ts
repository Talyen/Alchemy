import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
import {
  ENEMY_TURN_START_GAINS,
  collectUncoveredEnemyTraitIds,
  isEnemyTraitTurnStartCovered,
} from "@/lib/content-systems/enemy-trait-coverage";
import { logError } from "../error-logger";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyMitigation } from "./enemy-mitigation-state";
import { hasEnemyTrait } from "./encounter-trait-state";

// Re-exported so existing deep-path consumers keep working; new code should
// import the coverage owner directly.
export { collectUncoveredEnemyTraitIds };

export function scaleByRoomMultiplier(state: BattleState, value: number): number {
  return Math.round(value * state.roomScalingMultiplier);
}

export function processEnemyRegeneration(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyRegeneration <= 0) return state;
  let nextState = applyEnemyHealingWithCombatText(state, state.enemyRegeneration, combatTexts);
  if (nextState.enemyHealth > state.enemyHealth && hasEnemyTrait(state, "regeneration"))
    nextState = recordEnemyAbilityActivation(nextState, "regeneration");
  return nextState;
}

export function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;
  for (const trait of state.currentEnemy.traits) {
    const gain = ENEMY_TURN_START_GAINS.get(trait.id);
    if (!gain) {
      if (!isEnemyTraitTurnStartCovered(trait.id)) {
        logError(`No turn-start handler for trait ${trait.id}`, "battle", { traitId: trait.id });
        if (import.meta.env.DEV) throw new Error(`Uncovered enemy trait: ${trait.id}`);
      }
      continue;
    }
    if (gain.everyOtherTurn && state.turn % 2 !== 0) continue;
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: gain.stat, amount: gain.amount });
    nextState = recordEnemyAbilityActivation(addEnemyMitigation(nextState, gain.stat, gain.amount), trait.id);
  }
  return nextState;
}
