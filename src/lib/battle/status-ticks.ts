/**
 * Player and enemy DoT ticks. Enemy DoTs run at enemy phase start; player DoTs during enemy resolution.
 * Player stun/freeze threshold-check normally runs when buildup is applied; tick-time
 * resolution remains as a fallback for pre-existing stacks.
 * Depends on: ./status-cc, ./status-helpers, ./damage-status-riders, ./combat-text, ./types, ../game-constants.
 * Depended on by: ./enemy-turn.
 */
import {
  applyPlayerCombatDamage,
  clampHealth,
  setEnemyStatus,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { getEnemyDamageMultiplier, getBurnBonusToBleedingMultiplier } from "./status-helpers";
import { applyPoisonTalentRiders } from "./damage-status-riders";
import { applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { decayArmorAfterDamage, decayHalvedStatus, decayPoisonStacks, rollPercent } from "./status-helpers";
import { computeLeechHeal, HALF_DIVISOR, POISON_GAIN_AMOUNT } from "../game-constants";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-events";
import { applyEnemyLeechHealing } from "./enemy-turn-attack";

/** Shared enemy DoT tail: clamp health, apply next stacks, optional riders, armor decay, trait threshold. */
function dealEnemyDotTick(
  state: BattleState,
  status: "burn" | "poison" | "bleed",
  finalDamage: number,
  nextStacks: number,
  combatTexts: CombatTextEvent[],
  applyRiders?: (state: BattleState) => BattleState,
): BattleState {
  const previousHealth = state.enemyHealth;
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };
  nextState = setEnemyStatus(nextState, status, nextStacks);
  if (applyRiders) nextState = applyRiders(nextState);
  nextState = decayArmorAfterDamage(nextState, finalDamage, "enemy", combatTexts);
  return processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);
}

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;
  // Burn has a talent chance to DOUBLE instead of halving — intentional for
  // burn-focused builds. Armor decay after burn only triggers if damage > 0.
  const multiplier = getEnemyDamageMultiplier(state, "burn") * getBurnBonusToBleedingMultiplier(state);
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "burn",
    amount: finalDamage,
  });
  let nextBurn = state.enemyStatuses.burn;
  if (rollPercent(state.talentEffects.burnDoubleChance, state.rng)) {
    nextBurn *= HALF_DIVISOR;
  } else {
    nextBurn = decayHalvedStatus(nextBurn);
  }
  return dealEnemyDotTick(state, "burn", finalDamage, nextBurn, combatTexts);
}

function applyParasiticBloomLeech(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (!rollPercent(state.trinketEffects.parasiticBloomLeechChance, state.rng)) return state;
  return applyHealingWithCombatText(state, computeLeechHeal(damage), combatTexts);
}

function tickPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "poison");
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "poison",
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
  return dealEnemyDotTick(state, "poison", finalDamage, nextPoison, combatTexts, (nextState) =>
    applyPoisonTalentRiders(applyParasiticBloomLeech(nextState, finalDamage, combatTexts), finalDamage, combatTexts),
  );
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) return state;
  // Bleed "bursts" — deals full stack as damage then resets to 0.
  // Pending leech healing is paid out here, matching the mechanic that
  // leech heals when bleed actually deals damage.
  const multiplier = getEnemyDamageMultiplier(state, "bleed");
  const finalDamage = Math.round(damage * multiplier);
  const leechAmount = state.pendingBleedLeechHealing;
  return dealEnemyDotTick(state, "bleed", finalDamage, 0, combatTexts, (nextState) => {
    let next = { ...nextState, pendingBleedLeechHealing: 0 };
    if (leechAmount > 0) {
      next = applyHealingWithCombatText(next, computeLeechHeal(leechAmount), combatTexts);
    }
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "damage",
      stat: "bleed",
      amount: finalDamage,
    });
    return next;
  });
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickBurn(state, combatTexts);
  nextState = tickPoison(nextState, combatTexts);
  nextState = tickBleed(nextState, combatTexts);
  return nextState;
}

/** Shared player DoT tail: apply damage + next stacks, optional riders, damage text, armor decay. */
function dealPlayerDotTick(
  state: BattleState,
  reducedDamage: number,
  status: "burn" | "poison" | "bleed",
  nextStacks: number,
  combatTexts: CombatTextEvent[],
  damageType?: string,
  applyRiders?: (state: BattleState) => BattleState,
): BattleState {
  let nextState = setPlayerStatus(applyPlayerCombatDamage(state, reducedDamage, damageType), status, nextStacks);
  if (applyRiders) nextState = applyRiders(nextState);
  const healthLost = state.playerHealth - nextState.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: status,
      amount: healthLost,
    });
  }
  return decayArmorAfterDamage(nextState, reducedDamage, "player", combatTexts);
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
  return dealPlayerDotTick(
    state,
    reducedDamage,
    "burn",
    decayHalvedStatus(state.playerStatuses.burn),
    combatTexts,
    "burn",
  );
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const reducedDamage = state.talentEffects.receiveHalfPoisonDamage ? Math.round(damage / HALF_DIVISOR) : damage;
  return dealPlayerDotTick(state, reducedDamage, "poison", decayPoisonStacks(state.playerStatuses.poison), combatTexts);
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
  return dealPlayerDotTick(state, finalDamage, "bleed", 0, combatTexts, undefined, (nextState) => {
    const enemyLeechDamage = Math.min(state.pendingEnemyBleedLeechHealing, state.playerHealth - nextState.playerHealth);
    let next = nextState;
    if (enemyLeechDamage > 0) {
      next = applyEnemyLeechHealing(next, enemyLeechDamage, combatTexts);
    }
    return { ...next, pendingEnemyBleedLeechHealing: 0 };
  });
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerBleed(nextState, combatTexts);
  return resolvePlayerCrowdControlTriggers(nextState, combatTexts);
}
