import { mergeCombatText } from "./combat-text";
import { scaleByRoomMultiplier } from "./enemy-turn-traits";
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
  if (
    !hasEnemyTrait(state, "divine-aegis") ||
    state.flags.divineAegisTriggered ||
    previousHealth <= state.enemyMaxHealth / 2 ||
    state.enemyHealth > state.enemyMaxHealth / 2
  )
    return state;
  let nextState = { ...state, flags: { ...state.flags, divineAegisTriggered: true } };
  nextState = addEnemyMitigationWithCombatText(nextState, "armor", scaleByRoomMultiplier(nextState, 2), combatTexts);
  return addEnemyMitigationWithCombatText(nextState, "block", scaleByRoomMultiplier(nextState, 4), combatTexts);
}
