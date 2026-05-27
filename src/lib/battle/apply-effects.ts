/**
 * Dispatches and reduces card effects to update the battle state.
 * Depends on: @/lib/game-data, ./damage, ./status-effects, ./apply-effects-mana, ./apply-effects-utility.
 * Depended on by: ./card-play, ./enemy-turn.
 */
import type { BattleCard, BattleCardEffect, EnemyStatusId } from "@/lib/game-data";
import { dealDamageToEnemy } from "./damage";
import { applyPlayerStatusEffect } from "./status-effects";
import { handleManaEffect } from "./apply-effects-mana";
import { handleUtilityEffect } from "./apply-effects-utility";
import { addEnemyStatus, adjustEnemyStatusDelta, type BattleState, type CombatTextEvent } from "./types";
import { POTION_CARD_ID_SUFFIX } from "../game-constants";
import { applyHealingWithCombatText, mergeCombatText } from "./combat-text";

function handleDamageEffect(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedEffect = potionMult !== 1 ? { ...effect, amount: Math.round(effect.amount * potionMult) } : effect;
  return dealDamageToEnemy(state, card, adjustedEffect, combatTexts);
}

function handlePlayerStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let adjustedAmount = effect.amount;
  if (effect.perManaCrystal) {
    adjustedAmount = effect.perManaCrystal * state.maxMana;
  }
  if (potionMult !== 1) {
    adjustedAmount = Math.round(adjustedAmount * potionMult);
  }
  const adjustedEffect = { ...effect, amount: adjustedAmount };
  return applyPlayerStatusEffect(state, adjustedEffect, combatTexts);
}

function handleEnemyStatusEffect(
  state: BattleState,
  effect: { status: EnemyStatusId; amount: number },
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedDelta = adjustEnemyStatusDelta(state, effect.amount);
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: effect.status, amount: adjustedDelta });
  return addEnemyStatus(state, effect.status, effect.amount);
}

function handleHealEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "heal" }>,
  potionMult: number,
  isConsume: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedHeal = Math.round(effect.amount * potionMult);
  const consumeBonus = isConsume ? (state.talentEffects.consumeHealMultiplier ?? 0) : 0;
  const healAmount = Math.round(adjustedHeal * (state.talentEffects.healMultiplier + consumeBonus));
  return applyHealingWithCombatText(state, healAmount, combatTexts);
}

export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  const potionMult = card.id.endsWith(POTION_CARD_ID_SUFFIX) ? state.talentEffects.potionPotency : 1;

  return card.effects.reduce((currentState, effect) => {
    if (effect.kind === "damage") {
      return handleDamageEffect(currentState, card, effect, potionMult, combatTexts);
    }
    if (effect.kind === "player-status") {
      return handlePlayerStatusEffect(currentState, effect, potionMult, combatTexts);
    }
    if ((effect as { kind: string }).kind === "enemy-status") {
      return handleEnemyStatusEffect(
        currentState,
        effect as unknown as { status: EnemyStatusId; amount: number },
        combatTexts,
      );
    }
    if (effect.kind === "heal") {
      return handleHealEffect(currentState, effect, potionMult, card.consume ?? false, combatTexts);
    }
    if (
      effect.kind === "restore-mana" ||
      effect.kind === "lose-mana" ||
      effect.kind === "gain-max-mana" ||
      effect.kind === "lose-max-mana"
    ) {
      return handleManaEffect(currentState, effect, potionMult, combatTexts);
    }
    return handleUtilityEffect(currentState, card, effect, potionMult, combatTexts);
  }, state);
}
