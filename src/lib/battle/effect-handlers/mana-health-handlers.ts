import { hasCardHealing } from "./handler-types";
import type { EffectHandlers } from "./handler-types";
import { isPotionCard } from "@/lib/game-data";
import { applyCardHealing, applyHealthLossTalentRewards, checkHealthThresholds } from "../status-player";
import { applyPotionMultiplier } from "../amount-helpers";
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../../game-constants";
import { applyHealOnManaGain, gainManaWithCombatText, applyHealingWithCombatText } from "../player-rewards";
import { mergeCombatText } from "../combat-text-events";
import { dealSelfDamage } from "../status-helpers";
import type { BattleState, CombatTextEvent } from "../types";
import { ccDeepenedSinceStart } from "./handler-types";
import { resolveFollowUpHit } from "../follow-up-hit-resolution";

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
  return resolveFollowUpHit(
    state,
    {
      source: "talent-fixed",
      damageType: "burn",
      amount: state.talentEffects.burnDamageOnManaCrystalLoss * crystalsLost,
    },
    combatTexts,
  );
}
function loseMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - amount);
  const crystalsLost = state.maxMana - newMaxMana;
  if (crystalsLost <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: crystalsLost });
  const nextState: BattleState = { ...state, maxMana: newMaxMana, mana: Math.min(newMaxMana, state.mana) };
  return burnEnemyOnManaCrystalLoss(nextState, crystalsLost, combatTexts);
}

export const MANA_HEALTH_HANDLERS = {
  "restore-mana": (state, _card, effect, potionMult, combatTexts, context) => {
    if (
      effect.ifEnemyFrozen &&
      !ccDeepenedSinceStart(state.enemyCC.freezeSkipTurns, context?.enemyFreezeSkipTurnsAtStart)
    ) {
      return state;
    }
    return restoreMana(state, effect.amount, potionMult, combatTexts, effect.allowOverflow);
  },
  "lose-mana": (state, _card, effect, _potionMult, combatTexts) => {
    return loseMana(state, effect.amount, combatTexts);
  },
  "gain-max-mana": (state, _card, effect, _potionMult, combatTexts) => {
    return gainMaxMana(state, effect.amount, combatTexts);
  },
  "lose-max-mana": (state, _card, effect, _potionMult, combatTexts) => {
    return loseMaxMana(state, effect.amount, combatTexts);
  },
  heal: (state, card, effect, potionMult, combatTexts, context) => {
    const potionBonus = isPotionCard(card) && effect.amount > 0 ? (state.talentEffects.homesteadPotionBonus ?? 0) : 0;
    const cardHealMultiplier = 1 + (state.talentEffects.cardHealMultipliers[card.id] ?? 0);
    const adjustedHeal =
      Math.round(applyPotionMultiplier(effect.amount, potionMult) * cardHealMultiplier) + potionBonus;
    const consumeBonus = card.consume
      ? state.talentEffects.consumeHealMultiplier + state.gearEffects.consumeHealBonusPercent / PERCENT_DENOMINATOR
      : 0;
    const cardSpecificBonus = state.talentEffects.cardHealBonus[card.id] ?? 0;
    const healAmount = Math.round(adjustedHeal * (1 + consumeBonus) + cardSpecificBonus);
    return hasCardHealing(context)
      ? applyCardHealing(state, healAmount, combatTexts)
      : applyHealingWithCombatText(state, healAmount, combatTexts);
  },
  "lose-health": (state, _card, effect, _potionMult, combatTexts) => {
    const { state: damaged, healthLost } = dealSelfDamage(state, effect.amount, "health", combatTexts);
    const thresholded = checkHealthThresholds(state.playerHealth, damaged.playerHealth, damaged, combatTexts);
    return applyHealthLossTalentRewards(state, thresholded, healthLost, combatTexts);
  },
} satisfies Partial<EffectHandlers>;
