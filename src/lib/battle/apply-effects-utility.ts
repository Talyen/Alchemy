/**
 * Non-damage, non-mana card effect handlers (gold, wish, companions, status utilities).
 * Depends on: @/lib/game-data, ./wish, ./status-effects, ./draw, ./combat-text, ./types.
 */
import {
  companionLibrary,
  type BattleCard,
  type BattleCardEffect,
  type CompanionId,
  type EnemyStatusId,
} from "@/lib/game-data";
import { applyWishEffect } from "./wish";
import { removeHarmfulPlayerStatuses } from "./status-effects";
import { applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { drawCards } from "./draw";
import {
  addGold,
  addPlayerStatus,
  adjustEnemyStatusDelta,
  applyPlayerCombatDamage,
  type BattleState,
  type CombatTextEvent,
} from "./types";

function handleGainGold(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedGold = Math.round(amount * potionMult);
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: adjustedGold });
  return addGold(state, adjustedGold);
}

function handleWish(
  state: BattleState,
  card: BattleCard,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedWish = Math.round(amount * potionMult);
  return applyWishEffect(state, card, adjustedWish, combatTexts);
}

function handleSummonCompanion(state: BattleState, companionId: CompanionId): BattleState {
  return { ...state, activeCompanion: companionLibrary[companionId] };
}

function handleBuffCompanion(state: BattleState, amount: number): BattleState {
  return { ...state, companionDamageBuff: state.companionDamageBuff + amount };
}

function handleRemoveHarmfulStatus(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedRemove = Math.round(amount * potionMult);
  return removeHarmfulPlayerStatuses(state, adjustedRemove, combatTexts);
}

function handleSelfDamage(
  state: BattleState,
  amount: number,
  damageType: EnemyStatusId,
  combatTexts: CombatTextEvent[],
): BattleState {
  const postDamage = applyPlayerCombatDamage(state, amount);
  const healthLost = state.playerHealth - postDamage.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: damageType,
      amount: healthLost,
    });
  }
  return addPlayerStatus(postDamage, damageType, amount);
}

function handleLoseHealth(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const postDamage = applyPlayerCombatDamage(state, amount);
  const healthLost = state.playerHealth - postDamage.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: "health",
      amount: healthLost,
    });
  }
  return postDamage;
}

function handleDrawCards(state: BattleState, amount: number): BattleState {
  const draw = drawCards(state.deck, state.discard, state.hand, amount, state.nextCardUid, state.rng);
  return {
    ...state,
    deck: draw.deck,
    discard: draw.discard,
    hand: draw.hand,
    nextCardUid: draw.nextCardUid,
  };
}

function handleRemoveEnemyArmor(state: BattleState, amount: number): BattleState {
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - amount),
    },
  };
}

function handleMultiplyEnemyStatus(
  state: BattleState,
  status: EnemyStatusId,
  factor: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const current = state.enemyStatuses[status];
  if (current <= 0) return state;
  const added = adjustEnemyStatusDelta(state, current * (factor - 1));
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "multiply",
    stat: status,
    amount: added,
  });
  return {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, [status]: current + added },
  };
}

function handleRemovePlayerStatus(
  state: BattleState,
  status: EnemyStatusId,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.playerStatuses[status] <= 0) return state;
  let nextState = {
    ...state,
    playerStatuses: { ...state.playerStatuses, [status]: 0 },
  };
  nextState = applyHealingWithCombatText(
    nextState,
    nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    combatTexts,
  );
  nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
  return nextState;
}

type UtilityEffect = Exclude<
  BattleCardEffect,
  { kind: "damage" | "player-status" | "heal" | "restore-mana" | "lose-mana" | "gain-max-mana" | "lose-max-mana" }
>;

export function handleUtilityEffect(
  state: BattleState,
  card: BattleCard,
  effect: UtilityEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  switch (effect.kind) {
    case "gain-gold":
      return handleGainGold(state, effect.amount, potionMult, combatTexts);
    case "wish":
      return handleWish(state, card, effect.amount, potionMult, combatTexts);
    case "summon-companion":
      return handleSummonCompanion(state, effect.companionId);
    case "buff-companion":
      return handleBuffCompanion(state, effect.amount);
    case "remove-harmful-status":
      return handleRemoveHarmfulStatus(state, effect.amount, potionMult, combatTexts);
    case "self-damage":
      return handleSelfDamage(state, effect.amount, effect.damageType, combatTexts);
    case "lose-health":
      return handleLoseHealth(state, effect.amount, combatTexts);
    case "draw-cards":
      return handleDrawCards(state, effect.amount);
    case "remove-enemy-armor":
      return handleRemoveEnemyArmor(state, effect.amount);
    case "multiply-enemy-status":
      return handleMultiplyEnemyStatus(state, effect.status, effect.factor, combatTexts);
    case "remove-player-status":
      return handleRemovePlayerStatus(state, effect.status, combatTexts);
    default:
      return ((_: never) => state)(effect);
  }
}
