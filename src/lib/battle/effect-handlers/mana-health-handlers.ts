import { hasCardHealing } from "./handler-types";
import type { EffectHandler } from "./handler-types";
import { isPotionCard } from "@/lib/game-data";
import {
  applyCardHealing,
  applyBlockReward,
  applyHealthLossTalentRewards,
  checkHealthThresholds,
} from "../status-player";
import { applyPotionMultiplier } from "../amount-helpers";
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../../game-constants";
import {
  applyHealOnManaGain,
  gainManaWithCombatText,
  mergeCombatText,
  applyHealingWithCombatText,
} from "../combat-text";
import { dealSelfDamage, getEnemyDamageMultiplier } from "../status-helpers";
import { resolvePlayerHealing, type BattleState, type CombatTextEvent } from "../types";
import { paceCombatMagnitude } from "../fight-pacing";
import { ccDeepenedSinceStart, defineHandler } from "./handler-types";
import { dealScaledBurnWithStacks } from "../scaled-damage";

function restoreMana(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  allowOverflow = false,
): BattleState {
  return gainManaWithCombatText(state, applyPotionMultiplier(amount, potionMult), combatTexts, {
    allowOverflow,
  });
}

function loseMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const mana = Math.max(0, state.mana - amount);
  const manaLost = state.mana - mana;
  if (manaLost > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: manaLost });
  }
  return { ...state, mana };
}

function gainMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount });
  let nextState: BattleState = {
    ...state,
    maxMana: state.maxMana + amount,
    mana: state.mana + amount,
  };
  nextState = applyHealOnManaGain(nextState, amount, combatTexts, state.mana);
  return nextState;
}

function burnEnemyOnManaCrystalLoss(
  state: BattleState,
  crystalsLost: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (crystalsLost <= 0 || state.talentEffects.burnDamageOnManaCrystalLoss <= 0 || state.enemyHealth <= 0) {
    return state;
  }
  return dealScaledBurnWithStacks(state, state.talentEffects.burnDamageOnManaCrystalLoss * crystalsLost, combatTexts, {
    multiplier: getEnemyDamageMultiplier(state, "burn"),
  });
}
function loseMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - amount);
  const crystalsLost = state.maxMana - newMaxMana;
  if (crystalsLost <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: crystalsLost });
  const nextState: BattleState = { ...state, maxMana: newMaxMana, mana: Math.min(newMaxMana, state.mana) };
  return burnEnemyOnManaCrystalLoss(nextState, crystalsLost, combatTexts);
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
    return restoreMana(state, effect.amount, potionMult, combatTexts, effect.allowOverflow);
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

export const applyHealEffect = defineHandler("heal", (state, card, effect, potionMult, combatTexts, context) => {
  const potionBonus = isPotionCard(card) && effect.amount > 0 ? (state.talentEffects.homesteadPotionBonus ?? 0) : 0;
  const cardHealMultiplier = 1 + (state.talentEffects.cardHealMultipliers[card.id] ?? 0);
  const adjustedHeal = Math.round(applyPotionMultiplier(effect.amount, potionMult) * cardHealMultiplier) + potionBonus;
  const consumeBonus = card.consume
    ? state.talentEffects.consumeHealMultiplier + state.gearEffects.consumeHealBonusPercent / PERCENT_DENOMINATOR
    : 0;
  const cardSpecificBonus = state.talentEffects.cardHealBonus[card.id] ?? 0;
  const healAmount = Math.round(adjustedHeal * (1 + consumeBonus) + cardSpecificBonus);
  // Feast belongs to the Potion's heal, excluding healing from its resulting reactions.
  const potionHealing = resolvePlayerHealing(state, paceCombatMagnitude(state, healAmount, "player")).restored;
  const healed = hasCardHealing(context)
    ? applyCardHealing(state, healAmount, combatTexts)
    : applyHealingWithCombatText(state, healAmount, combatTexts);
  if (
    hasCardHealing(context) &&
    isPotionCard(card) &&
    state.talentEffects.blockOnConsume > 0 &&
    potionHealing > 0 &&
    state.playerHealth + potionHealing === state.playerMaxHealth
  ) {
    return applyBlockReward(healed, state.talentEffects.blockOnConsume, combatTexts);
  }
  return healed;
});

export const applyLoseHealthEffect = defineHandler("lose-health", (state, _card, effect, _potionMult, combatTexts) => {
  const { state: damaged, healthLost } = dealSelfDamage(state, effect.amount, "health", combatTexts);
  const thresholded = checkHealthThresholds(state.playerHealth, damaged.playerHealth, damaged, combatTexts);
  return applyHealthLossTalentRewards(state, thresholded, healthLost, combatTexts);
});

export const MANA_HEALTH_HANDLERS = {
  heal: applyHealEffect,
  "restore-mana": applyRestoreManaEffect,
  "lose-mana": applyLoseManaEffect,
  "lose-max-mana": applyLoseMaxManaEffect,
  "gain-max-mana": applyGainMaxManaEffect,
  "lose-health": applyLoseHealthEffect,
} satisfies Partial<Record<import("@/lib/game-data").BattleCardEffectKind, EffectHandler>>;
