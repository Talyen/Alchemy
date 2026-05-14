// Main card-effect reducer: dispatches each card effect to the appropriate handler.
import { companionLibrary } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data/types";
import { dealDamageToEnemy } from "./damage";
import { applyPlayerStatusEffect, removeHarmfulPlayerStatuses } from "./status-effects";
import { applyWishEffect } from "./wish";
import { addGold, addPlayerStatus, applyPlayerCombatDamage, applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";
import { MIN_MAX_MANA_FLOOR, PERCENT_DENOMINATOR } from "../game-constants";

export function mergeCombatText(combatTexts: CombatTextEvent[], nextEvent: CombatTextEvent) {
  const existingEvent = combatTexts.find(
    (event) => event.target === nextEvent.target && event.kind === nextEvent.kind && event.stat === nextEvent.stat,
  );
  if (existingEvent) {
    existingEvent.amount += nextEvent.amount;
    return;
  }
  combatTexts.push(nextEvent);
}

export function applyIronwoodBuckler(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.blockToArmorThreshold > 0 && state.playerStatuses.block >= state.trinketEffects.blockToArmorThreshold) {
    state = {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        armor: state.playerStatuses.armor + state.trinketEffects.blockToArmorAmount,
      },
    };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount: state.trinketEffects.blockToArmorAmount });
  }
  return state;
}

export function applyBoneCharmHeal(state: BattleState, enemyWasAlive: boolean, combatTexts: CombatTextEvent[]) {
  if (state.enemyHealth <= 0 && enemyWasAlive && state.trinketEffects.boneCharmHealOnKill > 0) {
    const healAmount = state.trinketEffects.boneCharmHealOnKill;
    state = applyPlayerHealing(state, healAmount);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  }
  return state;
}

export function applyLuckyCloverGold(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (state.trinketEffects.luckyCloverGoldChance <= 0 || damage <= 0) return state;
  if (Math.random() * PERCENT_DENOMINATOR < state.trinketEffects.luckyCloverGoldChance) {
    const nextState = addGold(state, damage);
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: damage });
    return nextState;
  }
  return state;
}

export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  return card.effects.reduce((currentState, effect) => {
    switch (effect.kind) {
      case "damage":
        return dealDamageToEnemy(currentState, card, effect, combatTexts);
      case "player-status":
        return applyPlayerStatusEffect(currentState, effect, combatTexts);
      case "heal": {
        const healAmount = Math.floor(effect.amount * currentState.talentEffects.healMultiplier);
        mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
        return applyPlayerHealing(currentState, healAmount);
      }
      case "restore-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: currentState.mana + effect.amount };
      case "lose-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: Math.max(0, currentState.mana - effect.amount) };
      case "gain-max-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return { ...currentState, maxMana: currentState.maxMana + effect.amount, mana: currentState.mana + effect.amount };
      case "lose-max-mana": {
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, currentState.maxMana - effect.amount);
        return { ...currentState, maxMana: newMaxMana, mana: Math.min(newMaxMana, currentState.mana) };
      }
      case "gain-gold":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: effect.amount });
        return addGold(currentState, effect.amount);
      case "wish":
        return applyWishEffect(currentState, card, effect.amount, combatTexts);
      case "summon-companion":
        return { ...currentState, activeCompanion: companionLibrary[effect.companionId] };
      case "remove-harmful-status":
        return removeHarmfulPlayerStatuses(currentState, effect.amount, combatTexts);
      case "self-damage": {
        const postDamage = applyPlayerCombatDamage(currentState, effect.amount);
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: effect.damageType, amount: effect.amount });
        return addPlayerStatus(postDamage, effect.damageType, effect.amount);
      }
      default:
        return currentState;
    }
  }, state);
}
