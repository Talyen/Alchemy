import { HALF_DIVISOR, LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { emitStatusText } from "./combat-text-events";
import { paceCombatMagnitude } from "./fight-pacing";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyMitigation } from "./enemy-mitigation-state";
import { getEnemyTraitSet } from "./encounter-trait-state";
import { writeCombatFlag } from "./action-context";
import { scaleByRoomMultiplier } from "./amount-helpers";

export function addEnemyMitigationWithCombatText(
  state: BattleState,
  field: "forge" | "armor" | "block",
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const applied = field === "armor" ? amount : paceCombatMagnitude(state, amount, "enemy");
  if (applied <= 0) return state;
  emitStatusText(combatTexts, "enemy", field, applied);
  return addEnemyMitigation(state, field, applied);
}

export function processEncounterTraitHealthThreshold(
  previousHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyHealth <= 0 || previousHealth <= state.enemyHealth) return state;
  if (state.flags.secondWindTriggered && state.flags.divineAegisTriggered) return state;

  const halfHealth = state.enemyMaxHealth / HALF_DIVISOR;
  const crossedHalfHealth = previousHealth >= halfHealth && state.enemyHealth <= halfHealth;
  if (!crossedHalfHealth) return state;

  const traits = getEnemyTraitSet(state);
  const hasSecondWind = !state.flags.secondWindTriggered && traits.has("second-wind");
  const hasDivineAegis = !state.flags.divineAegisTriggered && traits.has("divine-aegis");
  if (!hasSecondWind && !hasDivineAegis) return state;

  let nextState = state;

  if (hasSecondWind) {
    const healAmount = Math.round(nextState.enemyMaxHealth * LABYRINTH_MODIFIER_CONFIG.secondWindHealing);
    nextState = applyEnemyHealingWithCombatText(
      recordEnemyAbilityActivation(writeCombatFlag(nextState, "secondWindTriggered", true), "second-wind"),
      healAmount,
      combatTexts,
      { skipFightPacing: true },
    );
  }

  if (hasDivineAegis) {
    nextState = recordEnemyAbilityActivation(writeCombatFlag(nextState, "divineAegisTriggered", true), "divine-aegis");
    nextState = addEnemyMitigationWithCombatText(nextState, "armor", scaleByRoomMultiplier(nextState, 2), combatTexts);
    nextState = addEnemyMitigationWithCombatText(nextState, "block", scaleByRoomMultiplier(nextState, 4), combatTexts);
  }

  return nextState;
}
