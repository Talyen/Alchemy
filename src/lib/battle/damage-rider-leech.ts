import { pickRandom } from "@/lib/utils";
import { type EnemyStatusId, type PlayerStatusId } from "@/lib/game-data";
import {
  addEnemyStatus,
  addPlayerStatus,
  playerStatusDelta,
  setFlag,
  type BattleState,
  type CombatTextEvent,
  type EnemyMitigation,
} from "./types";
import {
  addGoldWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
  mergeCombatText,
} from "./combat-text";
import { scaledGearLeechHeal } from "./gear-effects";
import { rollPercent, getBattleRng, rollTalentChance } from "./status-helpers";
import { FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import { computeLeechHeal } from "./leech-heal";

function executePlayerHealing(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  return applyHealingWithCombatText(state, Math.round(amount * state.talentEffects.healMultiplier), combatTexts, {
    skipFightPacing: true,
  });
}

function applyLeechStatusRider(state: BattleState, status: EnemyStatusId, chance: number, damage: number): BattleState {
  if (rollTalentChance(chance, state)) {
    return addEnemyStatus(state, status, damage);
  }
  return state;
}

function applyLeechManaRider(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  for (const chance of [state.talentEffects.manaOnLeechChance, state.gearEffects.manaOnLeechChance]) {
    if (rollTalentChance(chance, state)) {
      nextState = gainManaWithCombatText(nextState, 1, combatTexts);
    }
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
    const steal = pickRandom(pool, getBattleRng(state));
    if (steal) {
      const nextState = {
        ...state,
        enemyMitigation: { ...mit, [steal.key]: Math.max(0, mit[steal.key] - 1) },
      };
      return addPlayerStatus(nextState, steal.status, 1);
    }
  }
  return state;
}

function applyLeechHitRiders(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  let nextState = state;
  nextState = applyLeechStatusRider(nextState, "bleed", state.talentEffects.leechBleedChance, damage);
  nextState = applyLeechManaRider(nextState, combatTexts);
  nextState = applyLeechTrinketSiphonRider(nextState);
  nextState = applyLeechStatusRider(nextState, "poison", state.talentEffects.leechPoisonChance, damage);
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

export function applyDamageBlock(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyBlockPercentFromDamage <= 0) return state;
  const blockAmount = Math.round((damage * state.talentEffects.holyBlockPercentFromDamage) / PERCENT_DENOMINATOR);
  if (blockAmount <= 0) return state;
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "block",
    amount: playerStatusDelta(state, "block", blockAmount),
  });
  return addPlayerStatus(state, "block", blockAmount);
}

export function applyHolyTithe(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyGoldChance <= 0) return state;
  if (rollPercent(state.talentEffects.holyGoldChance, getBattleRng(state))) {
    return addGoldWithCombatText(state, damage, combatTexts);
  }
  return state;
}

export function payPendingBleedLeech(
  preHitHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  const leechAmount = state.pendingBleedLeechHealing;
  if (leechAmount <= 0) return state;

  const healthLost = Math.max(0, preHitHealth - state.enemyHealth);
  let nextState: BattleState = {
    ...state,
    pendingBleedLeechHealing: 0,
  };
  const leechPaid = Math.min(leechAmount, healthLost);
  if (leechPaid > 0) {
    nextState = applyHealingWithCombatText(
      nextState,
      scaledGearLeechHeal(computeLeechHeal(leechPaid), nextState.gearEffects),
      combatTexts,
      { skipFightPacing: true },
    );
  }
  return nextState;
}
