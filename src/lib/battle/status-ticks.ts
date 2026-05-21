// Player and enemy DoT tick functions, split from turns.ts for focused testing.
// Depends on effect helpers, combat constants, and battle state types.
import {
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { getEnemyDamageMultiplier } from "./status-effects";
import { mergeCombatText } from "./combat-text";
import {
  FREEZE_THRESHOLD_FRACTION,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
  POISON_DECAY_AMOUNT,
  POISON_GAIN_AMOUNT,
  STUN_THRESHOLD_FRACTION,
  BATTLE_CONFIG,
} from "../game-constants";

// ----- Enemy DoT ticks -----

export function decayHalvedStatus(value: number) {
  if (value <= 1) return 0;
  return Math.round(value / HALF_DIVISOR);
}

function decayEnemyArmorAfterDamage(state: BattleState, damage: number) {
  if (damage <= 0 || state.enemyArmor <= 0) return state;
  return { ...state, enemyArmor: state.enemyArmor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT };
}

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "burn");
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: finalDamage });
  let nextBurn = state.enemyStatuses.burn;
  if (
    state.talentEffects.burnDoubleChance > 0 &&
    Math.random() * PERCENT_DENOMINATOR < state.talentEffects.burnDoubleChance
  ) {
    nextBurn *= HALF_DIVISOR;
  } else {
    nextBurn = decayHalvedStatus(nextBurn);
  }
  const nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
    enemyStatuses: { ...state.enemyStatuses, burn: nextBurn },
  };
  return decayEnemyArmorAfterDamage(nextState, finalDamage);
}

function applyParasiticBloomLeech(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (
    state.trinketEffects.parasiticBloomLeechChance > 0 &&
    Math.random() * PERCENT_DENOMINATOR < state.trinketEffects.parasiticBloomLeechChance
  ) {
    const nextState = applyPlayerHealing(state, damage);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: damage });
    return nextState;
  }
  return state;
}

function tickPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "poison");
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "poison", amount: finalDamage });
  let nextPoison = state.enemyStatuses.poison;
  if (
    state.talentEffects.poisonGainChance > 0 &&
    Math.random() * PERCENT_DENOMINATOR < state.talentEffects.poisonGainChance
  ) {
    nextPoison += POISON_GAIN_AMOUNT;
  } else {
    nextPoison = Math.max(0, nextPoison - POISON_DECAY_AMOUNT);
  }
  let nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
    enemyStatuses: { ...state.enemyStatuses, poison: nextPoison },
  };

  nextState = applyParasiticBloomLeech(nextState, finalDamage, combatTexts);

  return decayEnemyArmorAfterDamage(nextState, finalDamage);
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) return state;
  let nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -damage, state.enemyMaxHealth),
    enemyStatuses: { ...state.enemyStatuses, bleed: 0 },
    pendingBleedLeechHealing: 0,
  };
  const leechAmount = state.pendingBleedLeechHealing;
  if (leechAmount > 0) {
    nextState = applyPlayerHealing(nextState, leechAmount);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: leechAmount });
  }
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: damage });
  return decayEnemyArmorAfterDamage(nextState, damage);
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickBurn(state, combatTexts);
  nextState = tickPoison(nextState, combatTexts);
  nextState = tickBleed(nextState, combatTexts);
  return nextState;
}

// ----- Player DoT ticks and CC triggers -----

function decayArmorAfterHarmfulStatusDamage(state: BattleState, damage: number) {
  if (damage <= 0 || state.playerStatuses.armor <= 0) return state;
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      armor: state.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT,
    },
  };
}

function tickPlayerBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.burn;
  if (damage <= 0) return state;
  const actualDamage = state.talentEffects.receiveHalfBurnDamage ? Math.round(damage / HALF_DIVISOR) : damage;
  const reducedDamage = state.talentEffects.armorMitigatesBurn
    ? Math.max(0, actualDamage - state.playerStatuses.armor)
    : actualDamage;
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "burn", amount: reducedDamage });
  }
  const nextState = {
    ...applyPlayerCombatDamage(state, reducedDamage),
    playerStatuses: { ...state.playerStatuses, burn: decayHalvedStatus(state.playerStatuses.burn) },
  };
  return decayArmorAfterHarmfulStatusDamage(nextState, reducedDamage);
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const reducedDamage = state.talentEffects.receiveHalfPoisonDamage ? Math.round(damage / HALF_DIVISOR) : damage;
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "poison", amount: reducedDamage });
  }
  const nextPoison = Math.max(0, state.playerStatuses.poison - 1);
  const nextState = {
    ...applyPlayerCombatDamage(state, reducedDamage),
    playerStatuses: { ...state.playerStatuses, poison: nextPoison },
  };
  return decayArmorAfterHarmfulStatusDamage(nextState, reducedDamage);
}

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "bleed", amount: damage });
  const nextState = {
    ...applyPlayerCombatDamage(state, damage),
    playerStatuses: { ...state.playerStatuses, bleed: 0 },
  };
  return decayArmorAfterHarmfulStatusDamage(nextState, damage);
}

// Checks player stun threshold and triggers a turn skip if exceeded.
function processPlayerStunTrigger(state: BattleState, combatTexts: CombatTextEvent[]) {
  const statusValue = state.playerStatuses.stun;
  if (statusValue <= 0) return state;
  const threshold = STUN_THRESHOLD_FRACTION;
  if (state.playerHealth <= 0 || statusValue < state.playerMaxHealth * threshold) {
    return state;
  }
  // If CC immunity is active, clear the status silently without triggering a skip.
  if (state.playerCCCooldown > 0) {
    return { ...state, playerStatuses: { ...state.playerStatuses, stun: 0 } };
  }
  mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: "stun", text: "Stunned" });
  return {
    ...state,
    playerStatuses: { ...state.playerStatuses, stun: 0 },
    playerStunSkipTurns: state.playerStunSkipTurns + BATTLE_CONFIG.BASE_CC_DURATION,
    playerCCCooldown: BATTLE_CONFIG.CC_IMMUNITY_DURATION,
  };
}

// Checks player freeze threshold and triggers a turn skip if exceeded.
function processPlayerFreezeTrigger(state: BattleState, combatTexts: CombatTextEvent[]) {
  const statusValue = state.playerStatuses.freeze;
  if (statusValue <= 0) return state;
  const threshold = FREEZE_THRESHOLD_FRACTION;
  if (state.playerHealth <= 0 || statusValue < state.playerMaxHealth * threshold) {
    return state;
  }
  // If CC immunity is active, clear the status silently without triggering a skip.
  if (state.playerCCCooldown > 0) {
    return { ...state, playerStatuses: { ...state.playerStatuses, freeze: 0 } };
  }
  mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: "freeze", text: "Frozen" });
  return {
    ...state,
    playerStatuses: { ...state.playerStatuses, freeze: 0 },
    playerFreezeSkipTurns: state.playerFreezeSkipTurns + BATTLE_CONFIG.BASE_CC_DURATION,
    playerCCCooldown: BATTLE_CONFIG.CC_IMMUNITY_DURATION,
  };
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerBleed(nextState, combatTexts);
  nextState = processPlayerStunTrigger(nextState, combatTexts);
  nextState = processPlayerFreezeTrigger(nextState, combatTexts);
  return nextState;
}
