// Mana and health-related card effect apply handlers.
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../../game-constants";
import { applyHealOnManaGain, mergeCombatText, applyHealingWithCombatText } from "../combat-text";
import { gainMana } from "../types";
import { dealSelfDamage, getEnemyDamageMultiplier } from "../status-helpers";
import type { BattleState, CombatTextEvent } from "../types";
import type { EffectHandler } from "./handler-types";
import { processEncounterTraitHealthThreshold } from "../encounter-trait-events";
import { dealEnemyScaledDamage } from "../gear-effects";
import { paceCombatMagnitude } from "../fight-pacing";

function restoreMana(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedMana = paceCombatMagnitude(state, Math.round(amount * potionMult), "player");
  const nextState = gainMana(state, adjustedMana);
  const gained = nextState.mana - state.mana;
  if (gained > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: gained });
    return applyHealOnManaGain(nextState, gained, combatTexts);
  }
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
    nextState = dealEnemyScaledDamage(
      nextState,
      nextState.talentEffects.burnDamageOnManaCrystalLoss,
      "burn",
      combatTexts,
      {
        multiplier: getEnemyDamageMultiplier(nextState, "burn"),
        riders: (damagedState) => processEncounterTraitHealthThreshold(state.enemyHealth, damagedState, combatTexts),
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
