/**
 * Player and enemy DoT ticks. Enemy DoTs run at enemy phase start; player DoTs during enemy resolution.
 * Player stun/freeze threshold-check normally runs when buildup is applied; tick-time
 * resolution remains as a fallback for pre-existing stacks.
 */
import {
  applyPlayerCombatDamage,
  scaleReceivedPlayerDamage,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import {
  decayArmorAfterDamage,
  decayHalvedStatus,
  decayPoisonStacks,
  getBurnBonusToBleedingMultiplier,
  getEnemyDamageMultiplier,
  rollPercent,
} from "./status-helpers";
import { HALF_DIVISOR, POISON_GAIN_AMOUNT } from "../game-constants";
import { computeLeechHeal } from "./leech-heal";
import { applyPoisonTalentRiders } from "./damage-status-riders";
import { applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { applyEnemyLeechHealing } from "./enemy-turn-attack";
import { tryPoisonStunProc } from "./player-typed-hit";
import { payPendingBleedLeech } from "./damage-rider-leech";
import { dealEnemyDotTick } from "./dot-resolve";

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
  return applyHealingWithCombatText(state, computeLeechHeal(damage), combatTexts, { skipFightPacing: true });
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
  return dealEnemyDotTick(state, "poison", finalDamage, nextPoison, combatTexts, (nextState) => {
    const afterRiders = applyPoisonTalentRiders(
      applyParasiticBloomLeech(nextState, finalDamage, combatTexts),
      finalDamage,
      combatTexts,
    );
    return tryPoisonStunProc(afterRiders, finalDamage, combatTexts);
  });
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) return state;
  // Bleed "bursts" — deals full stack as damage then resets to 0.
  // Pending leech healing is paid out here, matching the mechanic that
  // leech heals when bleed actually deals damage.
  const multiplier = getEnemyDamageMultiplier(state, "bleed");
  const finalDamage = Math.round(damage * multiplier);
  // Merge before the tick like burn/poison so all DoT damage text shares one order.
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "bleed",
    amount: finalDamage,
  });
  return dealEnemyDotTick(state, "bleed", finalDamage, 0, combatTexts, (nextState) => {
    return payPendingBleedLeech(state.enemyHealth, nextState, combatTexts);
  });
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyStatuses.burn <= 0 && state.enemyStatuses.poison <= 0 && state.enemyStatuses.bleed <= 0) {
    return state;
  }
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

/**
 * Canonical player DoT mitigation chain, shared by burn and bleed so their
 * order cannot drift: percentage resists first, then flat reductions
 * (block-scaled talents, armor last) — matching applyPlayerCombatDamage.
 */
function mitigatePlayerDot(state: BattleState, damage: number, status: "burn" | "bleed"): number {
  const scaled = scaleReceivedPlayerDamage(damage, state.talentEffects, status);
  const blockReduction = status === "burn" ? state.talentEffects.blockReduceBurnDamage : 0;
  const afterBlock =
    blockReduction > 0 && state.playerStatuses.block > 0 ? Math.max(0, scaled - blockReduction) : scaled;
  const armorMitigates =
    status === "burn" ? state.talentEffects.armorMitigatesBurn : state.talentEffects.armorMitigatesBleed;
  return armorMitigates ? Math.max(0, afterBlock - state.playerStatuses.armor) : afterBlock;
}

function tickPlayerBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.burn;
  if (damage <= 0) return state;
  const reducedDamage = mitigatePlayerDot(state, damage, "burn");
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
  const reducedDamage = scaleReceivedPlayerDamage(damage, state.talentEffects, "poison");
  return dealPlayerDotTick(state, reducedDamage, "poison", decayPoisonStacks(state.playerStatuses.poison), combatTexts);
}

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) return state;
  const finalDamage = mitigatePlayerDot(state, damage, "bleed");
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
  if (state.playerStatuses.burn <= 0 && state.playerStatuses.poison <= 0 && state.playerStatuses.bleed <= 0) {
    return resolvePlayerCrowdControlTriggers(state, combatTexts);
  }
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerBleed(nextState, combatTexts);
  return resolvePlayerCrowdControlTriggers(nextState, combatTexts);
}
