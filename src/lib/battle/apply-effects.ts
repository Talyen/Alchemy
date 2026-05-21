/**
 * Dispatches and reduces card effects to update the battle state.
 * Depends on: @/lib/game-data, ./damage, ./status-effects, ./wish, ./types, ../game-constants, ./combat-text.
 * Depended on by: ./card-play, ./enemy-turn.
 */
import {
  companionLibrary,
  type BattleCard,
  type BattleCardEffect,
  type CompanionId,
  type EnemyStatusId,
} from "@/lib/game-data";
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

/**
 * Handles damage card effects.
 * Multiplies final damage by potion potency if card is a potion.
 */
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

/**
 * Handles player-status card effects.
 * Multiplies armor/block/etc by potion potency if card is a potion.
 */
function handlePlayerStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedEffect = potionMult !== 1 ? { ...effect, amount: Math.round(effect.amount * potionMult) } : effect;
  return applyPlayerStatusEffect(state, adjustedEffect, combatTexts);
}

/**
 * Handles healing card effects.
 * Scales by both potion potency and player talent healing multipliers.
 */
function handleHealEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "heal" }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedHeal = Math.round(effect.amount * potionMult);
  const healAmount = Math.round(adjustedHeal * state.talentEffects.healMultiplier);
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  return applyPlayerHealing(state, healAmount);
}

function handleRestoreMana(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedMana = Math.round(amount * potionMult);
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: adjustedMana });
  return { ...state, mana: state.mana + adjustedMana };
}

function handleLoseMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  return { ...state, mana: Math.max(0, state.mana - amount) };
}

function handleGainMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount });
  return {
    ...state,
    maxMana: state.maxMana + amount,
    mana: state.mana + amount,
  };
}

function handleLoseMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - amount);
  return { ...state, maxMana: newMaxMana, mana: Math.min(newMaxMana, state.mana) };
}

/**
 * Handles mana modification card effects.
 * Scales mana gains/losses by potion potency and respects max mana floors.
 */
function handleManaEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "restore-mana" | "lose-mana" | "gain-max-mana" | "lose-max-mana" }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  switch (effect.kind) {
    case "restore-mana":
      return handleRestoreMana(state, effect.amount, potionMult, combatTexts);
    case "lose-mana":
      return handleLoseMana(state, effect.amount, combatTexts);
    case "gain-max-mana":
      return handleGainMaxMana(state, effect.amount, combatTexts);
    case "lose-max-mana":
      return handleLoseMaxMana(state, effect.amount, combatTexts);
  }
}

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
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "damage",
    stat: damageType,
    amount: amount,
  });
  return addPlayerStatus(postDamage, damageType, amount);
}

/**
 * Handles non-mana utility card effects (gold, wish, companions, status removal, self-damage).
 * Coordinates gold gains, companion summons, status cleanses, and self-inflicted damage.
 */
function handleUtilityEffect(
  state: BattleState,
  card: BattleCard,
  effect: Exclude<
    BattleCardEffect,
    { kind: "damage" | "player-status" | "heal" | "restore-mana" | "lose-mana" | "gain-max-mana" | "lose-max-mana" }
  >,
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
  }
  return state;
}

/**
 * Reduces the array of card effects against the state, dispatching to helper functions.
 * Evaluates potion potency and iterates over card effects sequentially.
 */
export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  const potionMult = card.id.includes(POTION_CARD_ID_FRAGMENT) ? state.talentEffects.potionPotency : 1;

  return card.effects.reduce((currentState, effect) => {
    if (effect.kind === "damage") {
      return handleDamageEffect(currentState, card, effect, potionMult, combatTexts);
    }
    if (effect.kind === "player-status") {
      return handlePlayerStatusEffect(currentState, effect, potionMult, combatTexts);
    }
    if (effect.kind === "heal") {
      return handleHealEffect(currentState, effect, potionMult, combatTexts);
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
