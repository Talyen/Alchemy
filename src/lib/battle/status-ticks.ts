// Player and enemy DoT ticks. Enemy DoTs run at enemy phase start; player DoTs during enemy resolution.
// Player stun/freeze threshold-check runs here (not on damage). Depends on status-cc, status-helpers.
import {
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { getEnemyDamageMultiplier } from "./status-effects";
import { mergeCombatText } from "./combat-text";
import { resolvePlayerCrowdControlTrigger } from "./status-cc";
import { decayArmorAfterDamage, decayHalvedStatus, rollPercent } from "./status-helpers";
import {
  FREEZE_THRESHOLD_FRACTION,
  HALF_DIVISOR,
  POISON_DECAY_AMOUNT,
  POISON_GAIN_AMOUNT,
  STUN_THRESHOLD_FRACTION,
} from "../game-constants";

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "burn");
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: finalDamage });
  let nextBurn = state.enemyStatuses.burn;
  if (rollPercent(state.talentEffects.burnDoubleChance)) {
    nextBurn *= HALF_DIVISOR;
  } else {
    nextBurn = decayHalvedStatus(nextBurn);
  }
  const nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
    enemyStatuses: { ...state.enemyStatuses, burn: nextBurn },
  };
  return decayArmorAfterDamage(nextState, finalDamage, "enemy");
}

function applyParasiticBloomLeech(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (!rollPercent(state.trinketEffects.parasiticBloomLeechChance)) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: damage });
  return applyPlayerHealing(state, damage);
}

function tickPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "poison");
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "poison", amount: finalDamage });
  let nextPoison = state.enemyStatuses.poison;
  if (rollPercent(state.talentEffects.poisonGainChance)) {
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
  return decayArmorAfterDamage(nextState, finalDamage, "enemy");
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) return state;
  const leechAmount = state.pendingBleedLeechHealing;
  let nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -damage, state.enemyMaxHealth),
    enemyStatuses: { ...state.enemyStatuses, bleed: 0 },
    pendingBleedLeechHealing: 0,
  };
  if (leechAmount > 0) {
    nextState = applyPlayerHealing(nextState, leechAmount);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: leechAmount });
  }
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: damage });
  return decayArmorAfterDamage(nextState, damage, "enemy");
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
  return decayArmorAfterDamage(nextState, reducedDamage, "player");
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const reducedDamage = state.talentEffects.receiveHalfPoisonDamage ? Math.round(damage / HALF_DIVISOR) : damage;
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "poison", amount: reducedDamage });
  }
  const nextPoison = Math.max(0, state.playerStatuses.poison - POISON_DECAY_AMOUNT);
  const nextState = {
    ...applyPlayerCombatDamage(state, reducedDamage),
    playerStatuses: { ...state.playerStatuses, poison: nextPoison },
  };
  return decayArmorAfterDamage(nextState, reducedDamage, "player");
}

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "bleed", amount: damage });
  const nextState = {
    ...applyPlayerCombatDamage(state, damage),
    playerStatuses: { ...state.playerStatuses, bleed: 0 },
  };
  return decayArmorAfterDamage(nextState, damage, "player");
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerBleed(nextState, combatTexts);
  nextState = resolvePlayerCrowdControlTrigger({
    state: nextState,
    stat: "stun",
    stackValue: nextState.playerStatuses.stun,
    thresholdFraction: STUN_THRESHOLD_FRACTION,
    combatTexts,
  });
  nextState = resolvePlayerCrowdControlTrigger({
    state: nextState,
    stat: "freeze",
    stackValue: nextState.playerStatuses.freeze,
    thresholdFraction: FREEZE_THRESHOLD_FRACTION,
    combatTexts,
  });
  return nextState;
}
