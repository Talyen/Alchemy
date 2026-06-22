/**
 * Player and enemy DoT ticks. Enemy DoTs run at enemy phase start; player DoTs during enemy resolution.
 * Player stun/freeze threshold-check normally runs when buildup is applied; tick-time
 * resolution remains as a fallback for pre-existing stacks.
 * Depends on: ./status-cc, ./status-helpers, ./status-effects, ./combat-text, ./types, ../game-constants.
 * Depended on by: ./enemy-turn.
 */
import {
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  setEnemyStatus,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { getEnemyDamageMultiplier, applyPoisonTalentRiders } from "./status-effects";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { decayArmorAfterDamage, decayHalvedStatus, decayPoisonStacks, rollPercent } from "./status-helpers";
import { computeLeechHeal, HALF_DIVISOR, POISON_GAIN_AMOUNT } from "../game-constants";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-events";
import { applyEnemyLeechHealing } from "./enemy-turn-attack";

const CONSTANTS = {
  STATUS_NAMES: {
    BURN: "burn" as const,
    POISON: "poison" as const,
    BLEED: "bleed" as const,
    STUN: "stun" as const,
    FREEZE: "freeze" as const,
    BLOCK: "block" as const,
    ARMOR: "armor" as const,
    FORGE: "forge" as const,
    HEALTH: "health" as const,
  },
  DAMAGE_TYPES: {
    PHYSICAL: "physical" as const,
  },
  TARGETS: {
    PLAYER: "player" as const,
    ENEMY: "enemy" as const,
  },
  COMBAT_TEXT_KINDS: {
    DAMAGE: "damage" as const,
    HEAL: "heal" as const,
  },
  CLEAR_STATUS_STACK: 0,
} as const;

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;
  // Burn has a talent chance to DOUBLE instead of halving — intentional for
  // burn-focused builds. Armor decay after burn only triggers if damage > 0.
  let multiplier = getEnemyDamageMultiplier(state, CONSTANTS.STATUS_NAMES.BURN);
  if (state.enemyStatuses.bleed > 0 && state.gearEffects.burnDamageBonusToBleedingPercent > 0) {
    multiplier *= 1 + state.gearEffects.burnDamageBonusToBleedingPercent / 100;
  }
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, {
    target: CONSTANTS.TARGETS.ENEMY,
    kind: CONSTANTS.COMBAT_TEXT_KINDS.DAMAGE,
    stat: CONSTANTS.STATUS_NAMES.BURN,
    amount: finalDamage,
  });
  let nextBurn = state.enemyStatuses.burn;
  if (rollPercent(state.talentEffects.burnDoubleChance, state.rng)) {
    nextBurn *= HALF_DIVISOR;
  } else {
    nextBurn = decayHalvedStatus(nextBurn);
  }
  const previousHealth = state.enemyHealth;
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };
  nextState = setEnemyStatus(nextState, CONSTANTS.STATUS_NAMES.BURN, nextBurn);
  nextState = decayArmorAfterDamage(nextState, finalDamage, CONSTANTS.TARGETS.ENEMY, combatTexts);
  return processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);
}

function applyParasiticBloomLeech(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (!rollPercent(state.trinketEffects.parasiticBloomLeechChance, state.rng)) return state;
  const leechHeal = computeLeechHeal(damage);
  mergeCombatText(combatTexts, {
    target: CONSTANTS.TARGETS.PLAYER,
    kind: CONSTANTS.COMBAT_TEXT_KINDS.HEAL,
    stat: CONSTANTS.STATUS_NAMES.HEALTH,
    amount: leechHeal,
  });
  const prevState = state;
  const nextState = applyPlayerHealing(state, leechHeal);
  emitOverhealBlockText(prevState, nextState, combatTexts);
  return nextState;
}

function tickPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, CONSTANTS.STATUS_NAMES.POISON);
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, {
    target: CONSTANTS.TARGETS.ENEMY,
    kind: CONSTANTS.COMBAT_TEXT_KINDS.DAMAGE,
    stat: CONSTANTS.STATUS_NAMES.POISON,
    amount: finalDamage,
  });
  const isFrozenPreserved = state.enemyCC.freezeSkipTurns > 0 && state.talentEffects.freezePreventsPoisonDecay;
  let nextPoison = state.enemyStatuses.poison;
  if (!isFrozenPreserved) {
    if (rollPercent(state.talentEffects.poisonGainChance, state.rng)) {
      nextPoison += POISON_GAIN_AMOUNT;
    } else {
      nextPoison = decayPoisonStacks(nextPoison);
    }
  }
  const previousHealth = state.enemyHealth;
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };
  nextState = setEnemyStatus(nextState, CONSTANTS.STATUS_NAMES.POISON, nextPoison);
  nextState = applyParasiticBloomLeech(nextState, finalDamage, combatTexts);
  nextState = applyPoisonTalentRiders(nextState, finalDamage, combatTexts);
  nextState = decayArmorAfterDamage(nextState, finalDamage, CONSTANTS.TARGETS.ENEMY, combatTexts);
  return processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) return state;
  // Bleed "bursts" — deals full stack as damage then resets to 0.
  // Pending leech healing is paid out here, matching the mechanic that
  // leech heals when bleed actually deals damage.
  const multiplier = getEnemyDamageMultiplier(state, CONSTANTS.STATUS_NAMES.BLEED);
  const finalDamage = Math.round(damage * multiplier);
  const leechAmount = state.pendingBleedLeechHealing;
  const previousHealth = state.enemyHealth;
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
    pendingBleedLeechHealing: CONSTANTS.CLEAR_STATUS_STACK,
  };
  nextState = setEnemyStatus(nextState, CONSTANTS.STATUS_NAMES.BLEED, CONSTANTS.CLEAR_STATUS_STACK);
  if (leechAmount > 0) {
    const leechHeal = computeLeechHeal(leechAmount);
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, leechHeal);
    mergeCombatText(combatTexts, {
      target: CONSTANTS.TARGETS.PLAYER,
      kind: CONSTANTS.COMBAT_TEXT_KINDS.HEAL,
      stat: CONSTANTS.STATUS_NAMES.HEALTH,
      amount: leechHeal,
    });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  mergeCombatText(combatTexts, {
    target: CONSTANTS.TARGETS.ENEMY,
    kind: CONSTANTS.COMBAT_TEXT_KINDS.DAMAGE,
    stat: CONSTANTS.STATUS_NAMES.BLEED,
    amount: finalDamage,
  });
  nextState = decayArmorAfterDamage(nextState, finalDamage, CONSTANTS.TARGETS.ENEMY, combatTexts);
  return processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickBurn(state, combatTexts);
  nextState = tickPoison(nextState, combatTexts);
  nextState = tickBleed(nextState, combatTexts);
  return nextState;
}

function tickPlayerBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.burn;
  if (damage <= 0) return state;
  const actualDamage = state.talentEffects.receiveHalfBurnDamage ? Math.round(damage / HALF_DIVISOR) : damage;
  const afterBlockReduction =
    state.talentEffects.blockReduceBurnDamage > 0 && state.playerStatuses.block > 0
      ? Math.max(0, actualDamage - state.talentEffects.blockReduceBurnDamage)
      : actualDamage;
  const reducedDamage = state.talentEffects.armorMitigatesBurn
    ? Math.max(0, afterBlockReduction - state.playerStatuses.armor)
    : afterBlockReduction;
  const nextState = setPlayerStatus(
    applyPlayerCombatDamage(state, reducedDamage, "burn"),
    CONSTANTS.STATUS_NAMES.BURN,
    decayHalvedStatus(state.playerStatuses.burn),
  );
  const healthLost = state.playerHealth - nextState.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: CONSTANTS.TARGETS.PLAYER,
      kind: CONSTANTS.COMBAT_TEXT_KINDS.DAMAGE,
      stat: CONSTANTS.STATUS_NAMES.BURN,
      amount: healthLost,
    });
  }
  return decayArmorAfterDamage(nextState, reducedDamage, CONSTANTS.TARGETS.PLAYER, combatTexts);
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const reducedDamage = state.talentEffects.receiveHalfPoisonDamage ? Math.round(damage / HALF_DIVISOR) : damage;
  const nextPoison = decayPoisonStacks(state.playerStatuses.poison);
  const nextState = setPlayerStatus(
    applyPlayerCombatDamage(state, reducedDamage),
    CONSTANTS.STATUS_NAMES.POISON,
    nextPoison,
  );
  const healthLost = state.playerHealth - nextState.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: CONSTANTS.TARGETS.PLAYER,
      kind: CONSTANTS.COMBAT_TEXT_KINDS.DAMAGE,
      stat: CONSTANTS.STATUS_NAMES.POISON,
      amount: healthLost,
    });
  }
  return decayArmorAfterDamage(nextState, reducedDamage, CONSTANTS.TARGETS.PLAYER, combatTexts);
}

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) return state;
  const reducedDamage = state.talentEffects.armorMitigatesBleed
    ? Math.max(0, damage - state.playerStatuses.armor)
    : damage;
  const finalDamage = state.talentEffects.receiveHalfBleedDamage
    ? Math.round(reducedDamage / HALF_DIVISOR)
    : reducedDamage;
  let nextState = setPlayerStatus(
    applyPlayerCombatDamage(state, finalDamage),
    CONSTANTS.STATUS_NAMES.BLEED,
    CONSTANTS.CLEAR_STATUS_STACK,
  );
  const enemyLeechDamage = Math.min(state.pendingEnemyBleedLeechHealing, state.playerHealth - nextState.playerHealth);
  if (enemyLeechDamage > 0) {
    nextState = applyEnemyLeechHealing(nextState, enemyLeechDamage, combatTexts);
  }
  nextState = { ...nextState, pendingEnemyBleedLeechHealing: 0 };
  const healthLost = state.playerHealth - nextState.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: CONSTANTS.TARGETS.PLAYER,
      kind: CONSTANTS.COMBAT_TEXT_KINDS.DAMAGE,
      stat: CONSTANTS.STATUS_NAMES.BLEED,
      amount: healthLost,
    });
  }
  return decayArmorAfterDamage(nextState, finalDamage, CONSTANTS.TARGETS.PLAYER, combatTexts);
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerBleed(nextState, combatTexts);
  return resolvePlayerCrowdControlTriggers(nextState, combatTexts);
}
