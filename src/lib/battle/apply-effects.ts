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
  adjustEnemyStatusDelta,
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { MIN_MAX_MANA_FLOOR, POTION_CARD_ID_SUFFIX } from "../game-constants";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { drawCards } from "./draw";

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

/**
 * Handles healing card effects.
 * Scales by both potion potency and player talent healing multipliers.
 */
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
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  const nextState = applyPlayerHealing(state, healAmount);
  emitOverhealBlockText(state, nextState, combatTexts);
  return nextState;
}

function handleRestoreMana(
  state: BattleState,
  amount: number,
  potionMult: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const adjustedMana = Math.round(amount * potionMult);
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: adjustedMana });
  let nextState: BattleState = { ...state, mana: state.mana + adjustedMana };
  if (nextState.talentEffects.healOnManaGain > 0 && adjustedMana > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, nextState.talentEffects.healOnManaGain);
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  return nextState;
}

function handleLoseMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  return { ...state, mana: Math.max(0, state.mana - amount) };
}

function handleGainMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount });
  let nextState: BattleState = {
    ...state,
    maxMana: state.maxMana + amount,
    mana: state.mana + amount,
  };
  if (nextState.talentEffects.healOnManaGain > 0 && amount > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, nextState.talentEffects.healOnManaGain);
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  return nextState;
}

function handleLoseMaxMana(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount });
  const newMaxMana = Math.max(MIN_MAX_MANA_FLOOR, state.maxMana - amount);
  let nextState: BattleState = { ...state, maxMana: newMaxMana, mana: Math.min(newMaxMana, state.mana) };
  if (nextState.talentEffects.burnDamageOnManaCrystalLoss > 0 && nextState.enemyHealth > 0) {
    const burnDmg = nextState.talentEffects.burnDamageOnManaCrystalLoss;
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: burnDmg });
    nextState = { ...nextState, enemyHealth: clampHealth(nextState.enemyHealth, -burnDmg, nextState.enemyMaxHealth) };
  }
  return nextState;
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
  // Status applied even if damage is 0 — status-on-self-damage cards apply the rider
  // regardless of actual health reduction.
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
  // Two independent healing triggers: sin-eater trinket and talent healOnStatusCleanse.
  // Both fire on the same remove. Order matters for overheal-to-block conversion since
  // emitOverhealBlockText diffs consecutive states.
  if (nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "heal",
      stat: "health",
      amount: nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
    });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  if (nextState.talentEffects.healOnStatusCleanse > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, nextState.talentEffects.healOnStatusCleanse);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "heal",
      stat: "health",
      amount: nextState.talentEffects.healOnStatusCleanse,
    });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  return nextState;
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
      return state;
  }
}

/**
 * Reduces the array of card effects against the state, dispatching to helper functions.
 * Evaluates potion potency and iterates over card effects sequentially.
 */
export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  const potionMult = card.id.endsWith(POTION_CARD_ID_SUFFIX) ? state.talentEffects.potionPotency : 1;

  return card.effects.reduce((currentState, effect) => {
    if (effect.kind === "damage") {
      return handleDamageEffect(currentState, card, effect, potionMult, combatTexts);
    }
    if (effect.kind === "player-status") {
      return handlePlayerStatusEffect(currentState, effect, potionMult, combatTexts);
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
