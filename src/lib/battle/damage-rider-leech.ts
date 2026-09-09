import { applyCardHealing } from "./status-player";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { type EnemyStatusId, type PlayerStatusId } from "@/lib/game-data";
import {
  addEnemyStatus,
  addPlayerStatus,
  setFlag,
  type BattleState,
  type CombatTextEvent,
  type EnemyMitigation,
} from "./types";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
} from "./combat-text";
import { scaledGearLeechHeal } from "./gear-effects";
import { rollTalentChance } from "./status-helpers";
import { getBattleRng, pickRandom, rollPercent } from "@/lib/rng";
import { scalePercent } from "./amount-helpers";
import { FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR, LEECH_HEAL_FRACTION, PERCENT_DENOMINATOR } from "../game-constants";

export function computeLeechHeal(damageDealt: number): number {
  if (damageDealt <= 0) return 0;
  return Math.round(damageDealt * LEECH_HEAL_FRACTION);
}

export function scalePlayerLeechHeal(state: BattleState, amount: number): number {
  return amount * (hasEncounterBenefit(state, "blood-feast") ? LABYRINTH_MODIFIER_CONFIG.double : 1);
}

export function applyLeechHealing(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options: { cardHealing?: boolean; afflicted?: boolean } = {},
): BattleState {
  const afflicted = options.afflicted ?? (state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0);
  const bonus = afflicted ? state.talentEffects.afflictionLeechBonusPercent : 0;
  const healing = Math.round(amount * (1 + bonus / PERCENT_DENOMINATOR));
  let restored = options.cardHealing
    ? applyCardHealing(state, healing, combatTexts, { skipFightPacing: true })
    : applyHealingWithCombatText(state, healing, combatTexts, { skipFightPacing: true });
  const actualHealing = Math.max(0, restored.playerHealth - state.playerHealth);
  if (
    state.playerHealth < state.playerMaxHealth / 2 &&
    state.talentEffects.leechBlockBelowHalfPercent > 0 &&
    actualHealing > 0
  ) {
    restored = addPlayerStatusWithCombatText(
      restored,
      "block",
      Math.round((actualHealing * state.talentEffects.leechBlockBelowHalfPercent) / 100),
      combatTexts,
      { skipFightPacing: true },
    );
  }
  return healing > 0 &&
    state.playerHealth < state.playerMaxHealth &&
    restored.playerHealth >= restored.playerMaxHealth &&
    state.talentEffects.nextAttackPhysicalOnLeechToFull > 0
    ? setFlag(restored, "sanguinePhysicalBonus", state.talentEffects.nextAttackPhysicalOnLeechToFull)
    : restored;
}

function executePlayerHealing(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  cardHealing = false,
): BattleState {
  if (amount <= 0) return state;
  return applyLeechHealing(
    state,
    Math.round(scalePlayerLeechHeal(state, amount) * state.talentEffects.healMultiplier),
    combatTexts,
    { cardHealing },
  );
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
      if (steal.status === "block") {
        return addPlayerStatusWithCombatText(nextState, steal.status, 1, undefined, { skipFightPacing: true });
      }
      return addPlayerStatus(nextState, steal.status, 1);
    }
  }
  return state;
}

export function applyLeechHitRewards(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  let nextState = state;
  nextState = applyLeechStatusRider(nextState, "bleed", state.talentEffects.leechBleedChance, damage);
  nextState = applyLeechManaRider(nextState, combatTexts);
  nextState = applyLeechTrinketSiphonRider(nextState);
  return applyLeechStatusRider(nextState, "poison", state.talentEffects.leechPoisonChance, damage);
}

export function applyLeechHitHealing(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  cardHealing = false,
  cardLeech = cardHealing,
) {
  if (damage <= 0) return state;

  let healAmount = computeLeechHeal(damage);

  if (state.talentEffects.firstLeechCardDoubled && !state.flags.firstLeechCardDoubledUsed) {
    healAmount *= FIRST_EFFECT_MULTIPLIER;
    state = setFlag(state, "firstLeechCardDoubledUsed", true);
  }

  if (state.talentEffects.leechDesperateMultiplier > 0 && state.playerHealth < state.playerMaxHealth / HALF_DIVISOR) {
    healAmount = Math.round(healAmount * (1 + state.talentEffects.leechDesperateMultiplier / PERCENT_DENOMINATOR));
  }

  if (state.talentEffects.leechExecuteMultiplier > 0 && state.enemyHealth < state.enemyMaxHealth / HALF_DIVISOR) {
    healAmount = Math.round(healAmount * (1 + state.talentEffects.leechExecuteMultiplier / PERCENT_DENOMINATOR));
  }

  if (state.talentEffects.leechMissingHealthStep > 0) {
    const missing = state.playerMaxHealth - state.playerHealth;
    healAmount += Math.round(missing / state.talentEffects.leechMissingHealthStep);
  }

  healAmount = scaledGearLeechHeal(healAmount, state.gearEffects);
  if (cardLeech && state.talentEffects.cardLeechBonusPercent > 0) {
    healAmount = Math.round(healAmount * (1 + state.talentEffects.cardLeechBonusPercent / PERCENT_DENOMINATOR));
  }

  return executePlayerHealing(state, healAmount, combatTexts, cardHealing);
}

export function applyHolyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyLifestealPercent <= 0) return state;
  const healAmount = scalePercent(damage, state.talentEffects.holyLifestealPercent);
  if (healAmount <= 0) return state;
  return executePlayerHealing(state, scaledGearLeechHeal(healAmount, state.gearEffects), combatTexts);
}

export function applyDamageBlock(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyBlockPercentFromDamage <= 0) return state;
  const blockAmount = scalePercent(damage, state.talentEffects.holyBlockPercentFromDamage);
  if (blockAmount <= 0) return state;
  return addPlayerStatusWithCombatText(state, "block", blockAmount, combatTexts, { skipFightPacing: true });
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
  afflicted = state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0,
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
    nextState = applyLeechHealing(
      nextState,
      scalePlayerLeechHeal(nextState, scaledGearLeechHeal(computeLeechHeal(leechPaid), nextState.gearEffects)),
      combatTexts,
      { afflicted },
    );
  }
  return nextState;
}
