import { harmfulPlayerStatusIds } from "@/lib/game-data";
import { resolvePlayerHealing } from "./health-state";
import { isPlayerDefeated } from "./battle-outcome";
import { rollBattleChance } from "./chance-roll";
import { applyCardHealing, removeHarmfulPlayerStatuses } from "./status-player";
import { hasEncounterBenefit, hasEnemyTrait } from "./encounter-trait-state";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { BattleState, CombatTextEvent } from "./types";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
} from "./player-rewards";
import { scaledGearLeechHeal } from "./scaled-damage";
import { applyPercentBonus, scalePercent } from "./amount-helpers";
import { resolveStunFollowUpHit } from "./status-stun-core";
import { HALF_DIVISOR, LEECH_HEAL_FRACTION, PERCENT_DENOMINATOR } from "../game-constants";

export function computeLeechHeal(damageDealt: number): number {
  if (damageDealt <= 0) return 0;
  return Math.round(damageDealt * LEECH_HEAL_FRACTION);
}

function applyDesperateLeechBonus(state: BattleState, amount: number): number {
  return state.playerHealth < state.playerMaxHealth / HALF_DIVISOR
    ? applyPercentBonus(amount, state.talentEffects.leechDesperateMultiplier, PERCENT_DENOMINATOR)
    : amount;
}

function scalePlayerLeechHeal(state: BattleState, amount: number): number {
  return amount * (hasEncounterBenefit(state, "blood-feast") ? LABYRINTH_MODIFIER_CONFIG.double : 1);
}

function leechHealingAmount(
  state: BattleState,
  amount: number,
  afflicted = state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0,
): number {
  const bonus = afflicted ? state.talentEffects.afflictionLeechBonusPercent : 0;
  return (
    applyPercentBonus(amount, bonus, PERCENT_DENOMINATOR) +
    (amount > 0 ? (state.talentEffects.homesteadLeechHealing ?? 0) : 0)
  );
}

export function applyLeechHealing(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options: { cardHealing?: boolean; afflicted?: boolean } = {},
): BattleState {
  if (hasEnemyTrait(state, "hollow-frame")) return state;
  const healing = leechHealingAmount(state, amount, options.afflicted);
  return resolveLeechResourceRewards(state, healing, combatTexts, options);
}

/** Shared base scaler: desperate → gear → Deep Siphon → blood-feast. */
function scaleLeechBase(state: BattleState, amount: number): number {
  const base = scaledGearLeechHeal(applyDesperateLeechBonus(state, amount), state.gearEffects);
  return scalePlayerLeechHeal(state, base + state.talentEffects.leechHealingBonus);
}

export function applyScaledLeechHealing(
  state: BattleState,
  rawAmount: number,
  combatTexts: CombatTextEvent[],
  options: { cardHealing?: boolean; afflicted?: boolean } = {},
): BattleState {
  if (rawAmount <= 0) return state;
  return applyLeechHealing(state, scaleLeechBase(state, rawAmount), combatTexts, options);
}

/** Thunderstone is a shallow trinket hit: restore its actual Health damage with ordinary Leech gain riders. */
export function applyThunderstoneLeech(state: BattleState, damage: number, texts: CombatTextEvent[]): BattleState {
  return applyScaledLeechHealing(state, computeLeechHeal(damage), texts);
}

/** Amount already includes Leech scaling; all riders use this restoration's own facts. */
function resolveLeechResourceRewards(
  state: BattleState,
  amount: number,
  texts: CombatTextEvent[],
  options: { cardHealing?: boolean } = {},
): BattleState {
  const restoredHealth = resolvePlayerHealing(state, amount).restored;
  const belowHalf = state.playerHealth < state.playerMaxHealth / HALF_DIVISOR;
  const restoredToFull = restoredHealth > 0 && state.playerHealth + restoredHealth >= state.playerMaxHealth;
  let restored =
    options.cardHealing === true
      ? applyCardHealing(state, amount, texts, { skipFightPacing: true, allowOverhealBlock: false })
      : applyHealingWithCombatText(state, amount, texts, { skipFightPacing: true });
  if (restoredHealth > 0) {
    if (state.playerStatuses.thorns === 0 && state.gearEffects.thornsOnLeechWithoutThorns > 0)
      restored = addPlayerStatusWithCombatText(restored, "thorns", state.gearEffects.thornsOnLeechWithoutThorns, texts);
    if (belowHalf && state.gearEffects.stunOnLeechBelowHalfHealth > 0)
      restored = resolveStunFollowUpHit(
        restored,
        state.gearEffects.stunOnLeechBelowHalfHealth,
        texts,
        applyThunderstoneLeech,
      );
    if (isPlayerDefeated(restored)) return restored;
    if (rollBattleChance(state.gearEffects.leechBlockChance, state))
      restored = addPlayerStatusWithCombatText(restored, "block", restoredHealth, texts, { skipFightPacing: true });
    if (restoredToFull && state.talentEffects.manaOnLeechToFull > 0)
      restored = gainManaWithCombatText(restored, state.talentEffects.manaOnLeechToFull, texts);
    if (rollBattleChance(state.talentEffects.leechGoldChance, state))
      restored = addGoldWithCombatText(restored, restoredHealth, texts);
  }
  if (amount <= 0 || isPlayerDefeated(restored)) return restored;
  return resolveLeechGainRewards(restored, texts);
}

function resolveLeechGainRewards(state: BattleState, texts: CombatTextEvent[]): BattleState {
  let next = state;
  if (
    state.talentEffects.leechCleanseChance > 0 &&
    harmfulPlayerStatusIds.some((status) => state.playerStatuses[status] > 0) &&
    rollBattleChance(state.talentEffects.leechCleanseChance, state)
  )
    next = removeHarmfulPlayerStatuses(next, 1, texts);
  for (const chance of [state.talentEffects.manaOnLeechChance, state.gearEffects.manaOnLeechChance])
    if (rollBattleChance(chance, state)) next = gainManaWithCombatText(next, 1, texts);
  return next;
}

export function applyLeechHitHealing(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  cardHealing = false,
) {
  if (damage <= 0) return state;

  const healAmount = scaleLeechBase(state, computeLeechHeal(damage));
  return healAmount > 0 ? applyLeechHealing(state, healAmount, combatTexts, { cardHealing }) : state;
}

export function applyHolyLifesteal(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  eligibility = state,
) {
  if (
    damage <= 0 ||
    state.talentEffects.holyLifestealPercent <= 0 ||
    eligibility.playerHealth >= eligibility.playerMaxHealth / HALF_DIVISOR
  )
    return state;
  const healAmount = scalePercent(damage, state.talentEffects.holyLifestealPercent);
  if (healAmount <= 0) return state;
  return applyScaledLeechHealing(state, healAmount, combatTexts);
}

export function applyHolyBlockChance(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  return healthDamage > 0 && rollBattleChance(state.talentEffects.holyBlockChance, state)
    ? addPlayerStatusWithCombatText(state, "block", healthDamage, combatTexts, { skipFightPacing: true })
    : state;
}

export function applyHolyTithe(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  return healthDamage > 0 &&
    state.talentEffects.holyGoldChance > 0 &&
    rollBattleChance(state.talentEffects.holyGoldChance, state)
    ? addGoldWithCombatText(state, healthDamage, combatTexts)
    : state;
}

export function payPendingBleedLeech(
  preHitHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
  afflicted = state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0,
  bleedHealthDamage = Math.max(0, preHitHealth - state.enemyHealth),
): BattleState {
  const leechAmount = state.pendingBleedLeechHealing;
  if (leechAmount <= 0) return state;

  let nextState: BattleState = {
    ...state,
    pendingBleedLeechHealing: 0,
    pendingCardBleedLeechHealing: 0,
  };
  const leechPaid = Math.min(leechAmount, bleedHealthDamage);
  if (leechPaid > 0) {
    nextState = applyScaledLeechHealing(nextState, computeLeechHeal(leechPaid), combatTexts, {
      afflicted,
      cardHealing: state.pendingCardBleedLeechHealing > 0,
    });
  }
  return nextState;
}
