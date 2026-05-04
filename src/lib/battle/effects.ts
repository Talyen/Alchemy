import { ailmentStatusIds, cardLibrary, type BattleCard, type BattleCardEffect } from "@/lib/game-data";

import {
  baseEnemyHealth,
  maxPlayerHealth,
  type BattleState,
  type CombatTextEvent,
} from "./types";

export function clampPlayer(value: number) {
  return Math.max(0, Math.min(maxPlayerHealth, value));
}

export function clampEnemy(value: number) {
  return Math.max(0, Math.min(baseEnemyHealth, value));
}

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

function dealEnemyDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  const forgeBonus = effect.damageType === "physical" || effect.damageType === "stun" ? state.playerStatuses.forge : 0;
  const rawAmount = effect.fromBlock ? state.playerStatuses.block : effect.amount + forgeBonus;
  const actualDamage = Math.max(0, rawAmount);

  const nextState: BattleState = {
    ...state,
    enemyHealth: clampEnemy(state.enemyHealth - actualDamage),
    enemyStatuses: { ...state.enemyStatuses },
  };

  if (effect.lifesteal && actualDamage > 0) {
    nextState.playerHealth = clampPlayer(nextState.playerHealth + actualDamage);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: actualDamage });
  }

  if (actualDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: actualDamage });
  }

  switch (effect.damageType) {
    case "burn":
      nextState.enemyStatuses.burn += actualDamage;
      break;
    case "poison":
      nextState.enemyStatuses.poison += actualDamage;
      break;
    case "bleed":
      nextState.enemyStatuses.bleed += actualDamage * 2;
      if (effect.lifesteal) {
        nextState.enemyStatuses.bleedLeech += actualDamage * 2;
      }
      break;
    case "stun":
      nextState.enemyStatuses.stun += actualDamage;
      if (nextState.enemyHealth > 0 && nextState.enemyStatuses.stun > nextState.enemyHealth / 2) {
        nextState.enemyStatuses.stun = 0;
        nextState.enemySkipTurns += 1;
      }
      break;
    case "freeze":
      nextState.enemyStatuses.freeze += actualDamage;
      if (nextState.enemyHealth > 0 && nextState.enemyStatuses.freeze >= nextState.enemyHealth / 2) {
        nextState.enemyStatuses.freeze = 0;
        nextState.enemySkipTurns += 1;
      }
      break;
    default:
      break;
  }

  return nextState;
}

function removePlayerAilments(state: BattleState, mode: "one" | "all") {
  const nextPlayerStatuses = { ...state.playerStatuses };

  if (mode === "all") {
    ailmentStatusIds.forEach((statusId) => {
      nextPlayerStatuses[statusId] = 0;
    });

    return {
      ...state,
      playerStatuses: nextPlayerStatuses,
    };
  }

  const firstAilment = ailmentStatusIds.find((statusId) => nextPlayerStatuses[statusId] > 0);
  if (firstAilment) {
    nextPlayerStatuses[firstAilment] = 0;
  }

  return {
    ...state,
    playerStatuses: nextPlayerStatuses,
  };
}

export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  return card.effects.reduce((currentState, effect) => {
    switch (effect.kind) {
      case "damage":
        return dealEnemyDamage(currentState, effect, combatTexts);
      case "player-status": {
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: effect.status, amount: effect.amount });
        return {
          ...currentState,
          playerStatuses: {
            ...currentState.playerStatuses,
            [effect.status]: currentState.playerStatuses[effect.status] + effect.amount,
          },
        };
      }
      case "heal":
        mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: effect.amount });
        return { ...currentState, playerHealth: clampPlayer(currentState.playerHealth + effect.amount) };
      case "restore-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: currentState.mana + effect.amount };
      case "lose-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: Math.max(0, currentState.mana - effect.amount) };
      case "gain-max-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return { ...currentState, maxMana: currentState.maxMana + effect.amount };
      case "lose-max-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        return { ...currentState, maxMana: Math.max(1, currentState.maxMana - effect.amount) };
      case "gain-gold":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: effect.amount });
        return { ...currentState, gold: currentState.gold + effect.amount };
      case "wish":
        return { ...currentState, wishOptions: cardLibrary.filter((candidate) => candidate.id !== card.id).slice(0, 3) };
      case "remove-ailment":
        return removePlayerAilments(currentState, effect.mode);
      default:
        return currentState;
    }
  }, state);
}


