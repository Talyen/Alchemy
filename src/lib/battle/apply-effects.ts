// Main card-effect reducer: dispatches each card effect to the appropriate handler.
import { companionLibrary, type BattleCard } from "@/lib/game-data";
import { dealDamageToEnemy } from "./damage";
import { applyPlayerStatusEffect } from "./status-effects";
import { applyWishEffect } from "./wish";
import { mergeCombatText } from "./combat-text";
import { removeHarmfulPlayerStatuses } from "./status-effects";
import { applyPlayerCombatDamage, applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";
import { MIN_MAX_MANA_FLOOR } from "../game-constants";

export { mergeCombatText } from "./combat-text";
export { applyIronwoodBuckler, applyBoneCharmHeal } from "./trinket-utils";
export { getEnemyDamageMultiplier } from "./status-effects";

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
        return { ...currentState, gold: currentState.gold + effect.amount };
      case "wish":
        return applyWishEffect(currentState, card, effect.amount, combatTexts);
      case "summon-companion":
        return { ...currentState, activeCompanion: companionLibrary[effect.companionId] };
      case "remove-harmful-status":
        return removeHarmfulPlayerStatuses(currentState, effect.amount, combatTexts);
      case "self-damage": {
        const postDamage = applyPlayerCombatDamage(currentState, effect.amount);
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: effect.damageType, amount: effect.amount });
        return {
          ...postDamage,
          playerStatuses: {
            ...postDamage.playerStatuses,
            [effect.damageType]: postDamage.playerStatuses[effect.damageType] + effect.amount,
          },
        };
      }
      default:
        return currentState;
    }
  }, state);
}
