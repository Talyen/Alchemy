import { readCombatFlag } from "./action-context";
import { applyArmorReward, applyBlockReward, applyCardHealing } from "./status-player";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { type EnemyStatusId, type PlayerStatusId } from "@/lib/game-data";
import {
  addEnemyStatus,
  addPlayerStatus,
  setFlag,
  isPlayerDefeated,
  resolvePlayerHealing,
  type BattleState,
  type CombatTextEvent,
  type EnemyMitigation,
} from "./types";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
} from "./player-rewards";
import { scaledGearLeechHeal } from "./gear-effects";
import { rollTalentChance } from "./status-helpers";
import { getBattleRng, pickRandom } from "@/lib/rng";
import { applyPercentBonus, scalePercent } from "./amount-helpers";
import { resolveStunFollowUpHit } from "./stun-follow-up-hit";
import { FIRST_EFFECT_MULTIPLIER, HALF_DIVISOR, LEECH_HEAL_FRACTION, PERCENT_DENOMINATOR } from "../game-constants";

export function computeLeechHeal(damageDealt: number): number {
  if (damageDealt <= 0) return 0;
  return Math.round(damageDealt * LEECH_HEAL_FRACTION);
}

function addBloodDebtHealing(state: BattleState, amount: number): number {
  if (amount <= 0 || state.talentEffects.leechMissingHealthStep <= 0) return amount;
  return amount + Math.round((state.playerMaxHealth - state.playerHealth) / state.talentEffects.leechMissingHealthStep);
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
  let restored = options.cardHealing
    ? applyCardHealing(state, healing, combatTexts, { skipFightPacing: true, allowOverhealBlock: false })
    : applyHealingWithCombatText(state, healing, combatTexts, { skipFightPacing: true });
  if (actualHealing > 0 && state.playerStatuses.thorns === 0 && state.gearEffects.thornsOnLeechWithoutThorns > 0) {
    restored = addPlayerStatusWithCombatText(
      restored,
      "thorns",
      state.gearEffects.thornsOnLeechWithoutThorns,
      combatTexts,
    );
  }
  if (
    actualHealing > 0 &&
    state.playerHealth < state.playerMaxHealth / HALF_DIVISOR &&
    state.gearEffects.stunOnLeechBelowHalfHealth > 0
  ) {
    restored = resolveStunFollowUpHit(restored, state.gearEffects.stunOnLeechBelowHalfHealth, combatTexts);
  }
  if (actualHealing > 0 && rollTalentChance(state.gearEffects.leechBlockChance, state)) {
    restored = applyBlockReward(restored, actualHealing, combatTexts, { skipFightPacing: true });
  }
  if (
    state.playerHealth < state.playerMaxHealth / HALF_DIVISOR &&
    state.talentEffects.leechBlockBelowHalfPercent > 0 &&
    actualHealing > 0
  ) {
    restored = applyBlockReward(
      restored,
      Math.round((actualHealing * state.talentEffects.leechBlockBelowHalfPercent) / PERCENT_DENOMINATOR),
      combatTexts,
      { skipFightPacing: true },
    );
  }
  restored =
    actualHealing > 0 &&
    state.playerHealth + actualHealing >= state.playerMaxHealth &&
    state.talentEffects.manaOnLeechToFull > 0
      ? gainManaWithCombatText(restored, state.talentEffects.manaOnLeechToFull, combatTexts)
      : restored;
  if (actualHealing > 0 && rollTalentChance(state.talentEffects.leechGoldChance, state)) {
    restored = addGoldWithCombatText(restored, actualHealing, combatTexts);
  }
  restored =
    actualHealing > 0 &&
    state.playerHealth + actualHealing >= state.playerMaxHealth &&
    state.talentEffects.nextAttackPhysicalOnLeechToFull > 0
      ? setFlag(restored, "sanguinePhysicalBonus", state.talentEffects.nextAttackPhysicalOnLeechToFull)
      : restored;
  return healing > 0 && !isPlayerDefeated(restored) ? applyLeechManaRider(restored, combatTexts) : restored;
}

function executePlayerHealing(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  cardHealing = false,
): BattleState {
  if (amount <= 0) return state;
  return applyLeechHealing(state, scalePlayerLeechHeal(state, amount), combatTexts, { cardHealing });
}

export function applyScaledLeechHealing(
  state: BattleState,
  rawAmount: number,
  combatTexts: CombatTextEvent[],
  options: { cardHealing?: boolean; afflicted?: boolean } = {},
): BattleState {
  if (rawAmount <= 0) return state;
  return applyLeechHealing(
    state,
    scalePlayerLeechHeal(
      state,
      scaledGearLeechHeal(addBloodDebtHealing(state, applyDesperateLeechBonus(state, rawAmount)), state.gearEffects),
    ),
    combatTexts,
    options,
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

function applyLeechTrinketSiphonRider(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
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
      if (steal.status === "armor") {
        return applyArmorReward(nextState, 1, combatTexts);
      }
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
  nextState = applyLeechTrinketSiphonRider(nextState, combatTexts);
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

  if (state.talentEffects.firstLeechCardDoubled && !readCombatFlag(state, "firstLeechCardDoubledUsed")) {
    healAmount *= FIRST_EFFECT_MULTIPLIER;
    state = setFlag(state, "firstLeechCardDoubledUsed", true);
  }

  healAmount = applyDesperateLeechBonus(state, healAmount);

  if (state.talentEffects.leechExecuteMultiplier > 0 && state.enemyHealth < state.enemyMaxHealth / HALF_DIVISOR) {
    healAmount = applyPercentBonus(healAmount, state.talentEffects.leechExecuteMultiplier, PERCENT_DENOMINATOR);
  }

  healAmount = addBloodDebtHealing(state, healAmount);

  healAmount = scaledGearLeechHeal(healAmount, state.gearEffects);
  if (cardLeech && state.talentEffects.cardLeechBonusPercent > 0) {
    healAmount = applyPercentBonus(healAmount, state.talentEffects.cardLeechBonusPercent, PERCENT_DENOMINATOR);
  }

  return executePlayerHealing(state, healAmount, combatTexts, cardHealing);
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

export function applyHolyBlockChance(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || !rollTalentChance(state.talentEffects.holyBlockChance, state)) return state;
  return applyBlockReward(state, damage, combatTexts, { skipFightPacing: true });
}

export function applyHolyTithe(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyGoldChance <= 0) return state;
  if (rollTalentChance(state.talentEffects.holyGoldChance, state)) {
    return addGoldWithCombatText(state, damage, combatTexts);
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
  };
  const leechPaid = Math.min(leechAmount, bleedHealthDamage);
  if (leechPaid > 0) {
    nextState = applyScaledLeechHealing(nextState, computeLeechHeal(leechPaid), combatTexts, { afflicted });
  }
  return nextState;
}
