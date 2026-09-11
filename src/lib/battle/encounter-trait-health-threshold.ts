import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
import { paceCombatMagnitude } from "./fight-pacing";
import { addEnemyMitigation, hasEnemyTrait, type BattleState, type CombatTextEvent } from "./types";

export function addEnemyMitigationWithCombatText(
  state: BattleState,
  field: "forge" | "armor" | "block",
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const applied = field === "block" ? paceCombatMagnitude(state, amount, "enemy") : amount;
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: field, amount: applied });
  return addEnemyMitigation(state, field, applied);
}

export function processEncounterTraitHealthThreshold(
  previousHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  const halfHealth = state.enemyMaxHealth / 2;
  const crossedHalfHealth =
    previousHealth >= halfHealth && state.enemyHealth <= halfHealth && previousHealth > state.enemyHealth;
  if (
    hasEnemyTrait(state, "second-wind") &&
    !state.flags.secondWindTriggered &&
    state.enemyHealth > 0 &&
    crossedHalfHealth
  ) {
    state = applyEnemyHealingWithCombatText(
      { ...state, flags: { ...state.flags, secondWindTriggered: true } },
      Math.round(state.enemyMaxHealth * LABYRINTH_MODIFIER_CONFIG.secondWindHealing),
      combatTexts,
      { skipFightPacing: true },
    );
  }
  if (!hasEnemyTrait(state, "divine-aegis") || state.flags.divineAegisTriggered || !crossedHalfHealth) return state;
  let nextState = recordEnemyAbilityActivation(
    { ...state, flags: { ...state.flags, divineAegisTriggered: true } },
    "divine-aegis",
  );
  nextState = addEnemyMitigationWithCombatText(
    nextState,
    "armor",
    Math.round(2 * nextState.roomScalingMultiplier),
    combatTexts,
  );
  return addEnemyMitigationWithCombatText(
    nextState,
    "block",
    Math.round(4 * nextState.roomScalingMultiplier),
    combatTexts,
  );
}
