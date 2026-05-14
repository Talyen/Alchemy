// Player and enemy DoT tick functions, split from turns.ts for focused testing.
// Depends on effect helpers, combat constants, and battle state types.
import { applyPlayerCombatDamage, applyPlayerHealing, clampHealth, type BattleState, type CombatTextEvent } from "./types";
import { getEnemyDamageMultiplier } from "./status-effects";
import { mergeCombatText } from "./combat-text";
import { HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";

// ----- Enemy DoT ticks -----

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "burn");
  const finalDamage = Math.floor(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: finalDamage });
  let nextBurn = state.enemyStatuses.burn;
  if (state.talentEffects.burnDoubleChance > 0 && Math.random() * PERCENT_DENOMINATOR < state.talentEffects.burnDoubleChance) {
    nextBurn *= HALF_DIVISOR;
  } else {
    nextBurn = Math.floor(nextBurn / HALF_DIVISOR);
  }
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth), enemyStatuses: { ...state.enemyStatuses, burn: nextBurn } };
}

function tickPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "poison");
  const finalDamage = Math.floor(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "poison", amount: finalDamage });
  let nextPoison = state.enemyStatuses.poison;
  if (state.talentEffects.poisonGainChance > 0 && Math.random() * PERCENT_DENOMINATOR < state.talentEffects.poisonGainChance) {
    nextPoison += 1;
  } else {
    nextPoison = Math.max(0, nextPoison - 1);
  }
  let nextState = { ...state, enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth), enemyStatuses: { ...state.enemyStatuses, poison: nextPoison } };

  if (state.trinketEffects.parasiticBloomLeechChance > 0 && Math.random() * PERCENT_DENOMINATOR < state.trinketEffects.parasiticBloomLeechChance) {
    nextState = applyPlayerHealing(nextState, finalDamage);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: finalDamage });
  }

  return nextState;
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) return state;
  let nextState = { ...state, enemyHealth: clampHealth(state.enemyHealth, -damage, state.enemyMaxHealth), enemyStatuses: { ...state.enemyStatuses, bleed: 0, bleedLeech: 0 } };
  const leechAmount = state.enemyStatuses.bleedLeech;
  if (leechAmount > 0) {
    nextState = applyPlayerHealing(nextState, leechAmount);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: leechAmount });
  }
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: damage });
  return nextState;
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickBurn(state, combatTexts);
  nextState = tickPoison(nextState, combatTexts);
  nextState = tickBleed(nextState, combatTexts);
  return nextState;
}

// ----- Player DoT ticks -----

function decayArmorAfterHarmfulStatusDamage(state: BattleState, damage: number) {
  if (damage <= 0 || state.playerStatuses.armor <= 0) return state;
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      armor: state.playerStatuses.armor - 1,
    },
  };
}

function tickPlayerBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.burn;
  if (damage <= 0) return state;
  const actualDamage = state.talentEffects.receiveHalfBurnDamage ? Math.floor(damage / HALF_DIVISOR) : damage;
  const reducedDamage = state.talentEffects.armorMitigatesBurn
    ? Math.max(0, actualDamage - state.playerStatuses.armor)
    : actualDamage;
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "burn", amount: reducedDamage });
  }
  const nextState = { ...applyPlayerCombatDamage(state, reducedDamage), playerStatuses: { ...state.playerStatuses, burn: Math.floor(state.playerStatuses.burn / HALF_DIVISOR) } };
  return decayArmorAfterHarmfulStatusDamage(nextState, reducedDamage);
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const reducedDamage = state.talentEffects.receiveHalfPoisonDamage ? Math.floor(damage / HALF_DIVISOR) : damage;
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "poison", amount: reducedDamage });
  }
  const nextPoison = Math.max(0, state.playerStatuses.poison - 1);
  const nextState = { ...applyPlayerCombatDamage(state, reducedDamage), playerStatuses: { ...state.playerStatuses, poison: nextPoison } };
  return decayArmorAfterHarmfulStatusDamage(nextState, reducedDamage);
}

function tickPlayerHarmfulStatus(state: BattleState, status: "bleed" | "stun" | "freeze", combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses[status];
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: status, amount: damage });
  const nextState = { ...applyPlayerCombatDamage(state, damage), playerStatuses: { ...state.playerStatuses, [status]: 0 } };
  return decayArmorAfterHarmfulStatusDamage(nextState, damage);
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerHarmfulStatus(nextState, "bleed", combatTexts);
  nextState = tickPlayerHarmfulStatus(nextState, "stun", combatTexts);
  nextState = tickPlayerHarmfulStatus(nextState, "freeze", combatTexts);
  return nextState;
}
