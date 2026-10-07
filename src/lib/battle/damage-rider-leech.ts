import { rollBattleChance } from "./chance-roll";
import { applyBlockReward, applyCardHealing } from "./status-player";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { isPlayerDefeated, resolvePlayerHealing, type BattleState, type CombatTextEvent } from "./types";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
} from "./player-rewards";
import { scaledGearLeechHeal } from "./scaled-damage";
import { applyPercentBonus, scalePercent } from "./amount-helpers";
import { resolveStunFollowUpHit } from "./stun-follow-up-hit";
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

export function applyLeechHealing(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options: { cardHealing?: boolean; afflicted?: boolean } = {},
): BattleState {
  const afflicted = options.afflicted ?? (state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0);
  const bonus = afflicted ? state.talentEffects.afflictionLeechBonusPercent : 0;
  const healing =
    applyPercentBonus(amount, bonus, PERCENT_DENOMINATOR) +
    (amount > 0 ? (state.talentEffects.homesteadLeechHealing ?? 0) : 0);
  // Capture Leech's own restoration before cleansing or kill rewards can heal again.
  const actualHealing = resolvePlayerHealing(state, healing).restored;
  const belowHalf = state.playerHealth < state.playerMaxHealth / HALF_DIVISOR;
  const restoredToFull = actualHealing > 0 && state.playerHealth + actualHealing >= state.playerMaxHealth;
  let restored = options.cardHealing
    ? applyCardHealing(state, healing, combatTexts, { skipFightPacing: true, allowOverhealBlock: false })
    : applyHealingWithCombatText(state, healing, combatTexts, { skipFightPacing: true });
  if (actualHealing <= 0) {
    return healing > 0 && !isPlayerDefeated(restored) ? applyLeechManaRider(restored, combatTexts) : restored;
  }
  if (state.playerStatuses.thorns === 0 && state.gearEffects.thornsOnLeechWithoutThorns > 0) {
    restored = addPlayerStatusWithCombatText(
      restored,
      "thorns",
      state.gearEffects.thornsOnLeechWithoutThorns,
      combatTexts,
    );
  }
  if (belowHalf && state.gearEffects.stunOnLeechBelowHalfHealth > 0) {
    restored = resolveStunFollowUpHit(
      restored,
      state.gearEffects.stunOnLeechBelowHalfHealth,
      combatTexts,
      applyThunderstoneLeech,
    );
  }
  if (rollBattleChance(state.gearEffects.leechBlockChance, state)) {
    restored = applyBlockReward(restored, actualHealing, combatTexts, { skipFightPacing: true });
  }
  if (restoredToFull && state.talentEffects.manaOnLeechToFull > 0) {
    restored = gainManaWithCombatText(restored, state.talentEffects.manaOnLeechToFull, combatTexts);
  }
  if (rollBattleChance(state.talentEffects.leechGoldChance, state)) {
    restored = addGoldWithCombatText(restored, actualHealing, combatTexts);
  }
  return healing > 0 && !isPlayerDefeated(restored) ? applyLeechManaRider(restored, combatTexts) : restored;
}

/** Shared base scaler: desperate → gear → explicit card share → blood-feast. */
function scaleLeechBase(state: BattleState, amount: number, cardLeechFraction = 0): number {
  const base = scaledGearLeechHeal(applyDesperateLeechBonus(state, amount), state.gearEffects);
  return scalePlayerLeechHeal(
    state,
    applyPercentBonus(base, state.talentEffects.cardLeechBonusPercent * cardLeechFraction, PERCENT_DENOMINATOR),
  );
}

export function applyScaledLeechHealing(
  state: BattleState,
  rawAmount: number,
  combatTexts: CombatTextEvent[],
  options: { cardHealing?: boolean; afflicted?: boolean; cardLeechFraction?: number } = {},
): BattleState {
  if (rawAmount <= 0) return state;
  return applyLeechHealing(state, scaleLeechBase(state, rawAmount, options.cardLeechFraction), combatTexts, options);
}

/** Thunderstone is a shallow trinket hit: restore its actual Health damage with ordinary Leech gain riders. */
export function applyThunderstoneLeech(state: BattleState, damage: number, texts: CombatTextEvent[]): BattleState {
  return applyScaledLeechHealing(state, computeLeechHeal(damage), texts);
}

function applyLeechManaRider(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  for (const chance of [state.talentEffects.manaOnLeechChance, state.gearEffects.manaOnLeechChance]) {
    if (rollBattleChance(chance, state)) {
      nextState = gainManaWithCombatText(nextState, 1, combatTexts);
    }
  }
  return nextState;
}

export function applyLeechHitHealing(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  cardHealing = false,
  cardLeech = cardHealing,
) {
  if (damage <= 0) return state;

  const healAmount = scaleLeechBase(state, computeLeechHeal(damage), cardLeech ? 1 : 0);
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

export function applyDamageBlock(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  eligibility = state,
) {
  if (
    damage <= 0 ||
    state.talentEffects.holyBlockPercentFromDamage <= 0 ||
    eligibility.playerHealth !== eligibility.playerMaxHealth
  )
    return state;
  const blockAmount = scalePercent(damage, state.talentEffects.holyBlockPercentFromDamage);
  if (blockAmount <= 0) return state;
  return applyBlockReward(state, blockAmount, combatTexts, { skipFightPacing: true });
}

export function applyHolyBlockChance(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  if (healthDamage <= 0 || !rollBattleChance(state.talentEffects.holyBlockChance, state)) return state;
  return applyBlockReward(state, healthDamage, combatTexts, { skipFightPacing: true });
}

export function applyHolyTithe(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  if (healthDamage <= 0 || state.talentEffects.holyGoldChance <= 0) return state;
  if (rollBattleChance(state.talentEffects.holyGoldChance, state)) {
    return addGoldWithCombatText(state, healthDamage, combatTexts);
  }
  return state;
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
      cardLeechFraction: Math.min(1, state.pendingCardBleedLeechHealing / leechAmount),
    });
  }
  return nextState;
}
