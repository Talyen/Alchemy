import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
import { ENEMY_TURN_START_GAINS, isEnemyTraitTurnStartCovered } from "@/lib/content-systems/enemy-trait-coverage";
import { logError } from "../error-logger";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyMitigation } from "./enemy-mitigation-state";
import { resolveEnemyAttackHit } from "./enemy-attack-hit";
import { getBattleOutcome } from "./battle-outcome";
import { hasEnemyTrait } from "./encounter-trait-state";

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
    if ((trait.id === "crimson-pulse" || trait.id === "radiant-judgment") && state.turn % 2 === 0) {
      nextState = resolveEnemyAttackHit(
        recordEnemyAbilityActivation(nextState, trait.id),
        { kind: "damage", damageType: trait.id === "crimson-pulse" ? "bleed" : "holy", amount: 1 },
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
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: gain.stat, amount: gain.amount });
    nextState = recordEnemyAbilityActivation(addEnemyMitigation(nextState, gain.stat, gain.amount), trait.id);
  }
  return nextState;
}
