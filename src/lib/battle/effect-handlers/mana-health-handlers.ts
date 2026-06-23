// Mana and health-related card effect apply handlers.
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../../game-constants";
import { applyHealOnManaGain, mergeCombatText, applyHealingWithCombatText } from "../combat-text";
import { clampHealth, applyPlayerCombatDamage } from "../types";
import { getEnemyDamageMultiplier } from "../status-effects";
import type { BattleState, CombatTextEvent } from "../types";
import type { EffectHandler } from "./handler-types";
import { processEncounterTraitHealthThreshold } from "../encounter-trait-events";

function restoreMana(
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

function loseMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  return { ...state, mana: Math.max(0, state.mana - amount) };
}

function gainMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount });
  let nextState: BattleState = {
    ...state,
    maxMana: state.maxMana + amount,
    mana: state.mana + amount,
  };
  nextState = applyHealOnManaGain(nextState, amount, combatTexts);
  return nextState;
}

function loseMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - amount);
  let nextState: BattleState = { ...state, maxMana: newMaxMana, mana: Math.min(newMaxMana, state.mana) };
  if (nextState.talentEffects.burnDamageOnManaCrystalLoss > 0 && nextState.enemyHealth > 0) {
    const burnDmg = nextState.talentEffects.burnDamageOnManaCrystalLoss;
    const multiplier = getEnemyDamageMultiplier(nextState, "burn");
    const finalDamage = Math.round(burnDmg * multiplier);
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: finalDamage });
    nextState = {
      ...nextState,
      enemyHealth: clampHealth(nextState.enemyHealth, -finalDamage, nextState.enemyMaxHealth),
    };
    nextState = processEncounterTraitHealthThreshold(state.enemyHealth, nextState, combatTexts);
  }
  return nextState;
}

export const applyRestoreManaEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "restore-mana") return state;
  return restoreMana(state, effect.amount, potionMult, combatTexts);
};

export const applyLoseManaEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "lose-mana") return state;
  return loseMana(state, effect.amount, combatTexts);
};

export const applyGainMaxManaEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "gain-max-mana") return state;
  return gainMaxMana(state, effect.amount, combatTexts);
};

export const applyLoseMaxManaEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "lose-max-mana") return state;
  return loseMaxMana(state, effect.amount, combatTexts);
};

export const applyHealEffect: EffectHandler = (state, card, effect, potionMult, combatTexts) => {
  if (effect.kind !== "heal") return state;
  const adjustedHeal = Math.round(effect.amount * potionMult);
  const consumeBonus = card.consume
    ? state.talentEffects.consumeHealMultiplier + state.gearEffects.consumeHealBonusPercent / PERCENT_DENOMINATOR
    : 0;
  const cardSpecificBonus = state.talentEffects.cardHealBonus[card.id] ?? 0;
  const healAmount = Math.round(adjustedHeal * (state.talentEffects.healMultiplier + consumeBonus)) + cardSpecificBonus;
  return applyHealingWithCombatText(state, healAmount, combatTexts);
};

export const applyLoseHealthEffect: EffectHandler = (state, _card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "lose-health") return state;
  const postDamage = applyPlayerCombatDamage(state, effect.amount);
  const healthLost = state.playerHealth - postDamage.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: "health",
      amount: healthLost,
    });
  }
  return postDamage;
};
