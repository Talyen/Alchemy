// Mana and health-related card effect apply handlers.
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../../game-constants";
import {
  applyHealOnManaGain,
  gainManaWithCombatText,
  mergeCombatText,
  applyHealingWithCombatText,
} from "../combat-text";
import { dealSelfDamage, getEnemyDamageMultiplier } from "../status-helpers";
import type { BattleState, CombatTextEvent } from "../types";
import type { EffectHandler } from "./handler-types";
import { processEncounterTraitHealthThreshold } from "../encounter-trait-events";
import { dealEnemyScaledDamage } from "../gear-effects";
import { payKillPayouts } from "../kill-payouts";

function restoreMana(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const manaBefore = state.mana;
  const nextState = gainManaWithCombatText(state, Math.round(amount * potionMult), combatTexts);
  return applyHealOnManaGain(nextState, nextState.mana - manaBefore, combatTexts);
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
  const crystalsLost = state.maxMana - newMaxMana;
  let nextState: BattleState = { ...state, maxMana: newMaxMana, mana: Math.min(newMaxMana, state.mana) };
  if (crystalsLost > 0 && nextState.talentEffects.burnDamageOnManaCrystalLoss > 0 && nextState.enemyHealth > 0) {
    nextState = dealEnemyScaledDamage(
      nextState,
      nextState.talentEffects.burnDamageOnManaCrystalLoss * crystalsLost,
      "burn",
      combatTexts,
      {
        multiplier: getEnemyDamageMultiplier(nextState, "burn"),
        riders: (damagedState) =>
          payKillPayouts(
            processEncounterTraitHealthThreshold(state.enemyHealth, damagedState, combatTexts),
            state.enemyHealth > 0,
            combatTexts,
          ),
      },
    );
  }
  return nextState;
}

export const applyRestoreManaEffect: EffectHandler = (state, _card, effect, potionMult, combatTexts, context) => {
  if (effect.kind !== "restore-mana") return state;
  if (
    effect.ifEnemyFrozen &&
    state.enemyCC.freezeSkipTurns <= (context?.enemyFreezeSkipTurnsAtStart ?? state.enemyCC.freezeSkipTurns)
  ) {
    return state;
  }
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
  return dealSelfDamage(state, effect.amount, "health", combatTexts).state;
};
