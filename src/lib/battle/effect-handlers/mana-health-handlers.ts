import { ccDeepenedSinceStart, hasCardHealing, type EffectHandlers } from "./handler-types";
import { isPotionCard } from "@/lib/game-data";
import { applyCardHealing, applyHealthLossTalentRewards, checkHealthThresholds } from "../status-player";
import { applyPotionMultiplier } from "../amount-helpers";
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../../game-constants";
import { applyHealOnManaGain, gainManaWithCombatText, applyHealingWithCombatText } from "../player-rewards";
import { mergeCombatText } from "../combat-text-events";
import { dealSelfDamage } from "../status-helpers";
import type { BattleState, CombatTextEvent } from "../types";
import { resolveFollowUpHit } from "../follow-up-hit-resolution";

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

export const MANA_HEALTH_HANDLERS = {
  "restore-mana": (state, _card, effect, potionMult, combatTexts, context) => {
    if (
      effect.ifEnemyFrozen &&
      !ccDeepenedSinceStart(state.enemyCC.freezeSkipTurns, context?.enemyFreezeSkipTurnsAtStart)
    ) {
      return state;
    }
    return gainManaWithCombatText(state, applyPotionMultiplier(effect.amount, potionMult), combatTexts, {
      allowOverflow: effect.allowOverflow ?? false,
    });
  },
  "lose-mana": (state, _card, effect, _potionMult, combatTexts) => {
    const mana = Math.max(0, state.mana - effect.amount);
    const manaLost = state.mana - mana;
    if (manaLost > 0)
      mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: manaLost, impact: false });
    return { ...state, mana };
  },
  "gain-max-mana": (state, _card, effect, _potionMult, combatTexts) => {
    const amount = effect.amount;
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount });
    return applyHealOnManaGain(
      { ...state, maxMana: state.maxMana + amount, mana: state.mana + amount },
      amount,
      combatTexts,
      state.mana,
    );
  },
  "lose-max-mana": (state, _card, effect, _potionMult, combatTexts) => {
    const maxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - effect.amount);
    const crystalsLost = state.maxMana - maxMana;
    if (crystalsLost <= 0) return state;
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: "mana",
      amount: crystalsLost,
      impact: false,
    });
    return burnEnemyOnManaCrystalLoss(
      { ...state, maxMana, mana: Math.min(maxMana, state.mana) },
      crystalsLost,
      combatTexts,
    );
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
