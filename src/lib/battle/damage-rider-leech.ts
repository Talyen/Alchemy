import { type PlayerStatusId } from "@/lib/game-data";
import {
  addEnemyStatus,
  addGold,
  addPlayerStatus,
  applyPlayerHealing,
  setFlag,
  type BattleState,
  type CombatTextEvent,
  type EnemyMitigation,
} from "./types";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { scaledGearLeechHeal } from "./gear-effects";
import { rollPercent, getBattleRng } from "./status-helpers";
import { computeLeechHeal, FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";

export function rollTalentChance(chance: number, state: { rng?: () => number }): boolean {
  return chance > 0 && rollPercent(chance, getBattleRng(state));
}

function executePlayerHealing(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const healAmount = Math.round(amount * state.talentEffects.healMultiplier);
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  const nextState = applyPlayerHealing(state, healAmount);
  emitOverhealBlockText(state, nextState, combatTexts);
  return nextState;
}

function applyLeechBleedRider(state: BattleState, damage: number): BattleState {
  if (rollTalentChance(state.talentEffects.leechBleedChance, state)) {
    return addEnemyStatus(state, "bleed", damage);
  }
  return state;
}

function applyLeechManaRider(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (rollTalentChance(state.talentEffects.manaOnLeechChance, state)) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: 1 });
    nextState = { ...nextState, mana: nextState.mana + 1 };
  }
  if (rollTalentChance(state.gearEffects.manaOnLeechChance, state)) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: 1 });
    nextState = { ...nextState, mana: nextState.mana + 1 };
  }
  return nextState;
}

function applyLeechTrinketSiphonRider(state: BattleState): BattleState {
  if (rollTalentChance(state.talentEffects.trinketSiphonChance, state)) {
    const mit = state.enemyMitigation;
    const pool: Array<{ key: keyof EnemyMitigation; status: PlayerStatusId }> = [];
    if (mit.forge > 0) pool.push({ key: "forge", status: "forge" });
    if (mit.armor > 0) pool.push({ key: "armor", status: "armor" });
    if (mit.block > 0) pool.push({ key: "block", status: "block" });
    if (pool.length > 0) {
      const steal = pool[Math.trunc(getBattleRng(state)() * pool.length)]!;
      const nextState = {
        ...state,
        enemyMitigation: { ...mit, [steal.key]: Math.max(0, mit[steal.key] - 1) },
      };
      return addPlayerStatus(nextState, steal.status, 1);
    }
  }
  return state;
}

function applyLeechPoisonRider(state: BattleState, damage: number): BattleState {
  if (rollTalentChance(state.talentEffects.leechPoisonChance, state)) {
    return addEnemyStatus(state, "poison", damage);
  }
  return state;
}

/**
 * Applies standard lifesteal to restore player health based on damage dealt.
 */
function applyLeechHitRiders(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  let nextState = state;
  nextState = applyLeechBleedRider(nextState, damage);
  nextState = applyLeechManaRider(nextState, combatTexts);
  nextState = applyLeechTrinketSiphonRider(nextState);
  nextState = applyLeechPoisonRider(nextState, damage);
  return nextState;
}

export function applyLifestealAndPlayerHitTriggers(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0) return state;

  let healAmount = computeLeechHeal(damage);

  if (state.talentEffects.firstLeechCardDoubled && !state.flags.firstLeechCardDoubledUsed) {
    healAmount *= FIRST_EFFECT_MULTIPLIER;
    state = setFlag(state, "firstLeechCardDoubledUsed", true);
  }

  if (state.talentEffects.leechDesperateMultiplier > 0 && state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR) {
    healAmount = Math.round(healAmount * (1 + state.talentEffects.leechDesperateMultiplier / PERCENT_DENOMINATOR));
  }

  if (state.talentEffects.leechExecuteMultiplier > 0 && state.enemyHealth <= state.enemyMaxHealth / HALF_DIVISOR) {
    healAmount = Math.round(healAmount * (1 + state.talentEffects.leechExecuteMultiplier / PERCENT_DENOMINATOR));
  }

  if (state.talentEffects.leechMissingHealthStep > 0) {
    const missing = state.playerMaxHealth - state.playerHealth;
    healAmount += Math.round(missing / state.talentEffects.leechMissingHealthStep);
  }

  healAmount = scaledGearLeechHeal(healAmount, state.gearEffects);

  const nextState = executePlayerHealing(state, healAmount, combatTexts);
  return applyLeechHitRiders(nextState, damage, combatTexts);
}

/**
 * Restores player health proportionally for holy damage types.
 */
export function applyNatureLeech(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0) return state;
  const leechChance = state.talentEffects.natureLeechChance + state.gearEffects.natureLeechChance;
  if (leechChance <= 0 || !rollTalentChance(leechChance, state)) return state;
  return applyLifestealAndPlayerHitTriggers(state, damage, combatTexts);
}

export function applyHolyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyLifestealPercent <= 0) return state;
  const healAmount = Math.round((damage * state.talentEffects.holyLifestealPercent) / PERCENT_DENOMINATOR);
  if (healAmount <= 0) return state;
  return executePlayerHealing(state, healAmount, combatTexts);
}

/**
 * Grants player block proportionally when holy damage is dealt.
 */
export function applyDamageBlock(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyBlockPercentFromDamage <= 0) return state;
  const blockAmount = Math.round((damage * state.talentEffects.holyBlockPercentFromDamage) / PERCENT_DENOMINATOR);
  if (blockAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: blockAmount });
  return addPlayerStatus(state, "block", blockAmount);
}

/**
 * Grants gold proportional to holy damage with a percentage chance when Tithe is active.
 */
export function applyHolyTithe(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyGoldChance <= 0) return state;
  if (rollPercent(state.talentEffects.holyGoldChance, getBattleRng(state))) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: damage });
    return addGold(state, damage);
  }
  return state;
}

/**
 * Applies first-time burn multipliers from talents and boons, updating state in place.
 */
