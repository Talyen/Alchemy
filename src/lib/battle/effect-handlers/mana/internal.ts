import { MIN_MAX_MANA_FLOOR } from "../../../game-constants";
import { applyHealOnManaGain, mergeCombatText } from "../../combat-text";
import { clampHealth, type BattleState, type CombatTextEvent } from "../../types";

export function restoreMana(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedMana = Math.round(amount * potionMult);
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: adjustedMana });
  let nextState: BattleState = { ...state, mana: state.mana + adjustedMana };
  nextState = applyHealOnManaGain(nextState, adjustedMana, combatTexts);
  return nextState;
}

export function loseMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  return { ...state, mana: Math.max(0, state.mana - amount) };
}

export function gainMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount });
  let nextState: BattleState = {
    ...state,
    maxMana: state.maxMana + amount,
    mana: state.mana + amount,
  };
  nextState = applyHealOnManaGain(nextState, amount, combatTexts);
  return nextState;
}

export function loseMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - amount);
  let nextState: BattleState = { ...state, maxMana: newMaxMana, mana: Math.min(newMaxMana, state.mana) };
  if (nextState.talentEffects.burnDamageOnManaCrystalLoss > 0 && nextState.enemyHealth > 0) {
    const burnDmg = nextState.talentEffects.burnDamageOnManaCrystalLoss;
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: burnDmg });
    nextState = { ...nextState, enemyHealth: clampHealth(nextState.enemyHealth, -burnDmg, nextState.enemyMaxHealth) };
  }
  return nextState;
}
