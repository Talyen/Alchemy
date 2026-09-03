import { applyPotionMultiplier } from "../amount-helpers";
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../../game-constants";
import {
  applyHealOnManaGain,
  gainManaWithCombatText,
  mergeCombatText,
  applyHealingWithCombatText,
  payKillPayouts,
} from "../combat-text";
import { dealSelfDamage, getEnemyDamageMultiplier } from "../status-helpers";
import type { BattleState, CombatTextEvent } from "../types";
import { ccDeepenedSinceStart, defineHandler } from "./handler-types";
import { processEncounterTraitHealthThreshold } from "../encounter-trait-health-threshold";
import { dealEnemyScaledDamage } from "../gear-effects";

function restoreMana(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const manaBefore = state.mana;
  const nextState = gainManaWithCombatText(state, applyPotionMultiplier(amount, potionMult), combatTexts);
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

function burnEnemyOnManaCrystalLoss(
  state: BattleState,
  crystalsLost: number,
  previousEnemyHealth: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (crystalsLost <= 0 || state.talentEffects.burnDamageOnManaCrystalLoss <= 0 || state.enemyHealth <= 0) {
    return state;
  }
  return dealEnemyScaledDamage(
    state,
    state.talentEffects.burnDamageOnManaCrystalLoss * crystalsLost,
    "burn",
    combatTexts,
    {
      multiplier: getEnemyDamageMultiplier(state, "burn"),
      riders: (damagedState) =>
        payKillPayouts(
          processEncounterTraitHealthThreshold(previousEnemyHealth, damagedState, combatTexts),
          previousEnemyHealth > 0,
          combatTexts,
        ),
    },
  );
}
function loseMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - amount);
  const crystalsLost = state.maxMana - newMaxMana;
  const previousEnemyHealth = state.enemyHealth;
  const nextState: BattleState = { ...state, maxMana: newMaxMana, mana: Math.min(newMaxMana, state.mana) };
  return burnEnemyOnManaCrystalLoss(nextState, crystalsLost, previousEnemyHealth, combatTexts);
}

export const applyRestoreManaEffect = defineHandler(
  "restore-mana",
  (state, _card, effect, potionMult, combatTexts, context) => {
    if (
      effect.ifEnemyFrozen &&
      !ccDeepenedSinceStart(state.enemyCC.freezeSkipTurns, context?.enemyFreezeSkipTurnsAtStart)
    ) {
      return state;
    }
    return restoreMana(state, effect.amount, potionMult, combatTexts);
  },
);

export const applyLoseManaEffect = defineHandler("lose-mana", (state, _card, effect, _potionMult, combatTexts) => {
  return loseMana(state, effect.amount, combatTexts);
});

export const applyGainMaxManaEffect = defineHandler(
  "gain-max-mana",
  (state, _card, effect, _potionMult, combatTexts) => {
    return gainMaxMana(state, effect.amount, combatTexts);
  },
);

export const applyLoseMaxManaEffect = defineHandler(
  "lose-max-mana",
  (state, _card, effect, _potionMult, combatTexts) => {
    return loseMaxMana(state, effect.amount, combatTexts);
  },
);

export const applyHealEffect = defineHandler("heal", (state, card, effect, potionMult, combatTexts) => {
  const adjustedHeal = applyPotionMultiplier(effect.amount, potionMult);
  const consumeBonus = card.consume
    ? state.talentEffects.consumeHealMultiplier + state.gearEffects.consumeHealBonusPercent / PERCENT_DENOMINATOR
    : 0;
  const cardSpecificBonus = state.talentEffects.cardHealBonus[card.id] ?? 0;
  const healAmount = Math.round(adjustedHeal * (state.talentEffects.healMultiplier + consumeBonus)) + cardSpecificBonus;
  return applyHealingWithCombatText(state, healAmount, combatTexts);
});

export const applyLoseHealthEffect = defineHandler("lose-health", (state, _card, effect, _potionMult, combatTexts) => {
  return dealSelfDamage(state, effect.amount, "health", combatTexts).state;
});
