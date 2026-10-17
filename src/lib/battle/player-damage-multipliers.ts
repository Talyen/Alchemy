import { readCombatFlag } from "./action-context";
import type { BattleCard, BattleCardEffect, DamageType } from "@/lib/game-data";
import {
  ARCHERY_FULL_HEALTH_THRESHOLD_PERCENT,
  ARCHERY_LOW_HEALTH_THRESHOLD_PERCENT,
  HALF_DIVISOR,
  MIN_DAMAGE_MULTIPLIER,
  PERCENT_DENOMINATOR,
} from "../game-constants";
import { cardHasKeyword } from "./card-classification";
import { gearFrozenDamageMultiplier } from "./scaled-damage";
import {
  getBleedLowHealthDamageMultiplier,
  getBurnBonusToBleedingMultiplier,
  getEnemyDamageMultiplier,
} from "./status-helpers";
import type { BattleState } from "./types";
import { writeCombatFlag as setFlag } from "./action-context";

function isLikeDamage(damageType: DamageType, target: "burn" | "bleed", state: BattleState): boolean {
  return (
    damageType === target ||
    (state.gearEffects.sharedBurnBleedBonuses > 0 && (damageType === "burn" || damageType === "bleed"))
  );
}

function isBelowHalfHealth(state: BattleState): boolean {
  return state.playerHealth * HALF_DIVISOR < state.playerMaxHealth;
}

function computeEffectBonusMultiplier(
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  state: BattleState,
): number {
  let bonus = 0;
  if (effect.doubleIfEnemyBleeding && state.enemyStatuses.bleed > 0) bonus += 1;
  if (effect.tripleIfEnemyNotBurning && state.enemyStatuses.burn === 0) bonus += 2;
  return bonus;
}

function computeTypeSpecificDamageBonus(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
): number {
  let bonus = 0;
  if (isLikeDamage(effect.damageType, "burn", state)) {
    bonus += (state.maxMana * state.gearEffects.burnDamagePerManaPercent) / PERCENT_DENOMINATOR;
  }
  if (effect.damageType === "physical") {
    if (isBelowHalfHealth(state) && state.talentEffects.physicalDoubledBelowHalfHealth) bonus += 1;
    if (
      state.talentEffects.physicalDoubledBelowQuarterHealth &&
      state.enemyHealth * PERCENT_DENOMINATOR < state.enemyMaxHealth * 25
    ) {
      bonus += 1;
    }
  }
  if (effect.damageType === "holy" && state.enemyStatuses.burn > 0 && state.talentEffects.holyVsBurnMultiplier > 0) {
    bonus += state.talentEffects.holyVsBurnMultiplier / PERCENT_DENOMINATOR;
  }
  if (effect.damageType === "holy" && state.enemyCC.stunSkipTurns > 0) {
    bonus += state.gearEffects.holyBonusVsStunnedPercent / PERCENT_DENOMINATOR;
  }
  if (isLikeDamage(effect.damageType, "bleed", state)) {
    bonus += getBleedLowHealthDamageMultiplier(state) - 1;
  }
  return bonus;
}

function computeCardSpecificTalentBonus(state: BattleState, card?: BattleCard): number {
  let bonus = 0;
  if (card?.consume && state.talentEffects.consumeDamageBonusPercent > 0) {
    bonus += state.talentEffects.consumeDamageBonusPercent / PERCENT_DENOMINATOR;
  }
  if (card?.tags?.includes("archery")) {
    const talentEffects = state.talentEffects;

    if (
      talentEffects.archeryDoubledVsHighHealth &&
      state.enemyHealth * PERCENT_DENOMINATOR >= state.enemyMaxHealth * ARCHERY_FULL_HEALTH_THRESHOLD_PERCENT
    ) {
      bonus += 1;
    }
    if (
      talentEffects.archeryDoubledVsLowHealth &&
      state.enemyHealth * PERCENT_DENOMINATOR < state.enemyMaxHealth * ARCHERY_LOW_HEALTH_THRESHOLD_PERCENT
    ) {
      bonus += 1;
    }
  }
  return bonus;
}

function computeExternalDamageMultipliers(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  includeEnemyTraits: boolean,
): number {
  let bonus = 0;
  bonus += getEnemyDamageMultiplier(state, effect.damageType, includeEnemyTraits) - 1;
  bonus += gearFrozenDamageMultiplier(state) - 1;
  if (isLikeDamage(effect.damageType, "burn", state)) bonus += getBurnBonusToBleedingMultiplier(state) - 1;

  return bonus;
}

function computeAdditiveDamageBonus(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card: BattleCard | undefined,
  includeEnemyTraits: boolean,
): number {
  return (
    computeEffectBonusMultiplier(effect, state) +
    computeTypeSpecificDamageBonus(state, effect) +
    computeCardSpecificTalentBonus(state, card) +
    computeExternalDamageMultipliers(state, effect, includeEnemyTraits)
  );
}

export function applyFirstDamageBonus(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
): { state: BattleState; firstBonus: number } {
  let nextState: BattleState = state;
  let firstBonus = 0;

  if (isLikeDamage(effect.damageType, "burn", state)) {
    if (nextState.trinketEffects.firstBurnDoubled && !readCombatFlag(nextState, "firstBurnTrinketDoubledUsed")) {
      firstBonus += 1;
      nextState = setFlag(nextState, "firstBurnTrinketDoubledUsed", true);
    }
  }

  return { state: nextState, firstBonus };
}

export function resolveDamageBonusMultiplier(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  {
    card,
    firstBonus,
    companionAttack = false,
    includeEnemyTraits = true,
  }: {
    card?: BattleCard | undefined;
    firstBonus: number;
    companionAttack?: boolean;
    includeEnemyTraits?: boolean;
  },
): number {
  const unwoundedBonus =
    isLikeDamage(effect.damageType, "bleed", state) && state.enemyStatuses.bleed === 0
      ? state.talentEffects.bleedUnwoundedBonusPercent / PERCENT_DENOMINATOR
      : 0;
  const cullBonus =
    state.talentEffects.leechCardDamageVsLowHealthPercent > 0 &&
    card &&
    !companionAttack &&
    cardHasKeyword(card, "leech") &&
    state.enemyHealth < state.enemyMaxHealth / HALF_DIVISOR
      ? state.talentEffects.leechCardDamageVsLowHealthPercent / PERCENT_DENOMINATOR
      : 0;
  const totalBonus =
    computeAdditiveDamageBonus(state, effect, card, includeEnemyTraits) + firstBonus + unwoundedBonus + cullBonus;
  return Math.max(MIN_DAMAGE_MULTIPLIER, 1 + totalBonus);
}
