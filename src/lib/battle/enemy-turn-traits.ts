import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { emitStatusText } from "./combat-text-events";
import {
  ENEMY_TURN_START_DAMAGE,
  ENEMY_TURN_START_GAINS,
  isEnemyTraitTurnStartCovered,
} from "@/lib/content-systems/enemy-trait-coverage";
import { logError } from "../error-logger";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyMitigation } from "./enemy-mitigation-state";
import { resolveEnemyAttackHit } from "./enemy-attack-hit";
import { getBattleOutcome } from "./battle-outcome";
import { hasEnemyTrait } from "./encounter-trait-state";
import { CRIMSON_PULSE_TURN_INTERVAL } from "@/lib/game-constants";

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
    if (getBattleOutcome(nextState) !== null) break;
    const damageType = Object.hasOwn(ENEMY_TURN_START_DAMAGE, trait.id) ? ENEMY_TURN_START_DAMAGE[trait.id] : undefined;
    const damageInterval = trait.id === "crimson-pulse" ? CRIMSON_PULSE_TURN_INTERVAL : 2;
    if (damageType && state.turn % damageInterval === 0) {
      nextState = resolveEnemyAttackHit(
        recordEnemyAbilityActivation(nextState, trait.id),
        { kind: "damage", damageType, amount: 1 },
        combatTexts,
        { canDodge: false },
      ).state;
      continue;
    }
    const gain = ENEMY_TURN_START_GAINS.get(trait.id);
    if (!gain) {
      if (!isEnemyTraitTurnStartCovered(trait.id)) {
        logError(`No turn-start handler for trait ${trait.id}`, "battle", { traitId: trait.id });
        if (import.meta.env.DEV) throw new Error(`Uncovered enemy trait: ${trait.id}`);
      }
      continue;
    }
    if (gain.everyOtherTurn && state.turn % 2 !== 0) continue;
    emitStatusText(combatTexts, "enemy", gain.stat, gain.amount);
    nextState = recordEnemyAbilityActivation(addEnemyMitigation(nextState, gain.stat, gain.amount), trait.id);
  }
  return nextState;
}
