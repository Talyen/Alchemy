// Main card-effect reducer: dispatches each card effect to the appropriate handler.
import { companionLibrary } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data/types";
import { dealDamageToEnemy } from "./damage";
import { applyPlayerStatusEffect, removeHarmfulPlayerStatuses } from "./status-effects";
import { applyWishEffect } from "./wish";
import {
  addGold,
  addPlayerStatus,
  applyPlayerCombatDamage,
  applyPlayerHealing,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { MIN_MAX_MANA_FLOOR, POTION_CARD_ID_FRAGMENT } from "../game-constants";
import { mergeCombatText } from "./combat-text";

export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  const potionMult = card.id.includes(POTION_CARD_ID_FRAGMENT) ? state.talentEffects.potionPotency : 1;

  return card.effects.reduce((currentState, effect) => {
    switch (effect.kind) {
      case "damage": {
        if (potionMult !== 1) {
          const adjustedEffect = { ...effect, amount: Math.round(effect.amount * potionMult) };
          return dealDamageToEnemy(currentState, card, adjustedEffect, combatTexts);
        }
        return dealDamageToEnemy(currentState, card, effect, combatTexts);
      }
      case "player-status": {
        if (potionMult !== 1) {
          const adjustedEffect = { ...effect, amount: Math.round(effect.amount * potionMult) };
          return applyPlayerStatusEffect(currentState, adjustedEffect, combatTexts);
        }
        return applyPlayerStatusEffect(currentState, effect, combatTexts);
      }
      case "heal": {
        const adjustedHeal = Math.round(effect.amount * potionMult);
        const healAmount = Math.round(adjustedHeal * currentState.talentEffects.healMultiplier);
        mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
        return applyPlayerHealing(currentState, healAmount);
      }
      case "restore-mana": {
        const adjustedMana = Math.round(effect.amount * potionMult);
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: adjustedMana });
        return { ...currentState, mana: currentState.mana + adjustedMana };
      }
      case "lose-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: Math.max(0, currentState.mana - effect.amount) };
      case "gain-max-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return {
          ...currentState,
          maxMana: currentState.maxMana + effect.amount,
          mana: currentState.mana + effect.amount,
        };
      case "lose-max-mana": {
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, currentState.maxMana - effect.amount);
        return { ...currentState, maxMana: newMaxMana, mana: Math.min(newMaxMana, currentState.mana) };
      }
      case "gain-gold": {
        const adjustedGold = Math.round(effect.amount * potionMult);
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: adjustedGold });
        return addGold(currentState, adjustedGold);
      }
      case "wish": {
        const adjustedWish = Math.round(effect.amount * potionMult);
        return applyWishEffect(currentState, card, adjustedWish, combatTexts);
      }
      case "summon-companion":
        return { ...currentState, activeCompanion: companionLibrary[effect.companionId] };
      case "buff-companion":
        return { ...currentState, companionDamageBuff: currentState.companionDamageBuff + effect.amount };
      case "remove-harmful-status": {
        const adjustedRemove = Math.round(effect.amount * potionMult);
        return removeHarmfulPlayerStatuses(currentState, adjustedRemove, combatTexts);
      }
      case "self-damage": {
        const postDamage = applyPlayerCombatDamage(currentState, effect.amount);
        mergeCombatText(combatTexts, {
          target: "player",
          kind: "damage",
          stat: effect.damageType,
          amount: effect.amount,
        });
        return addPlayerStatus(postDamage, effect.damageType, effect.amount);
      }
      default:
        return currentState;
    }
  }, state);
}
