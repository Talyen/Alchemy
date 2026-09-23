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
import { gearFrozenDamageMultiplier } from "./gear-effects";
import { getBurnBonusToBleedingMultiplier, getEnemyDamageMultiplier } from "./status-helpers";
import { setFlag, type BattleState } from "./types";

function sharesBurnBleedBonuses(state: BattleState): boolean {
  return state.gearEffects.sharedBurnBleedBonuses > 0;
}

function isLikeDamage(damageType: DamageType, target: "burn" | "bleed", state: BattleState): boolean {
  return damageType === target || (sharesBurnBleedBonuses(state) && (damageType === "burn" || damageType === "bleed"));
}

function isBurnLikeDamage(damageType: DamageType, state: BattleState): boolean {
  return isLikeDamage(damageType, "burn", state);
}

function isBleedLikeDamage(damageType: DamageType, state: BattleState): boolean {
  return isLikeDamage(damageType, "bleed", state);
}

function doublingActive(flag: boolean, cc: number): boolean {
  return flag && cc > 0;
}

function isBelowHalfHealth(state: BattleState): boolean {
  return state.playerHealth * HALF_DIVISOR < state.playerMaxHealth;
}

function computeEffectBonusMultiplier(
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  state: BattleState,
): number {
  let bonus = 0;
  if (effect.doubleIfEnemyBurning && state.enemyStatuses.burn > 0) bonus += 1;
  if (effect.doubleIfEnemyBleeding && state.enemyStatuses.bleed > 0) bonus += 1;
  if (effect.doubleIfEnemyNotBurning && state.enemyStatuses.burn === 0) bonus += 1;
  if (effect.tripleIfEnemyNotBurning && state.enemyStatuses.burn === 0) bonus += 2;
  return bonus;
}

function computeTypeSpecificDamageBonus(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
): number {
  let bonus = 0;
  if (isBurnLikeDamage(effect.damageType, state)) {
    bonus += (state.maxMana * state.gearEffects.burnDamagePerManaPercent) / PERCENT_DENOMINATOR;
  }
  if (effect.damageType === "physical") {
    if (doublingActive(state.talentEffects.physicalDoubledVsStunned, state.enemyCC.stunSkipTurns)) bonus += 1;
    if (doublingActive(state.talentEffects.physicalDoubledVsFrozen, state.enemyCC.freezeSkipTurns)) bonus += 1;
    if (isBelowHalfHealth(state)) {
      bonus += state.talentEffects.physicalDoubledBelowHalfHealth
        ? 1
        : state.talentEffects.physicalLowHealthDamageBonusPercent / PERCENT_DENOMINATOR;
    }
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
  if (isBleedLikeDamage(effect.damageType, state)) {
    if (isBelowHalfHealth(state) && state.talentEffects.bleedDesperateMultiplier > 1) {
      bonus += state.talentEffects.bleedDesperateMultiplier - 1;
    }
    if (
      state.talentEffects.bleedExecuteThreshold > 0 &&
      state.enemyHealth * PERCENT_DENOMINATOR <= state.enemyMaxHealth * state.talentEffects.bleedExecuteThreshold
    ) {
      bonus += state.talentEffects.bleedExecuteMultiplier - 1;
    }
  }
  return bonus;
}

function computeCardSpecificTalentBonus(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
): number {
  let bonus = 0;
  if (card?.consume && state.talentEffects.consumeDamageBonusPercent > 0) {
    bonus += state.talentEffects.consumeDamageBonusPercent / PERCENT_DENOMINATOR;
  }
  if (
    isBurnLikeDamage(effect.damageType, state) &&
    card?.consume &&
    state.talentEffects.consumeBurnDamageBonusPercent > 0
  ) {
    bonus += state.talentEffects.consumeBurnDamageBonusPercent / PERCENT_DENOMINATOR;
  }
  if (card?.tags?.includes("archery")) {
    const cc = state.enemyCC;
    const talentEffects = state.talentEffects;
    if (doublingActive(talentEffects.archeryDoubledVsStunned, cc.stunSkipTurns)) bonus += 1;
    if (doublingActive(talentEffects.archeryDoubledVsFrozen, cc.freezeSkipTurns)) bonus += 1;
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
): number {
  let bonus = 0;
  const enemyMultiplier = getEnemyDamageMultiplier(state, effect.damageType);
  if (enemyMultiplier !== 1) bonus += enemyMultiplier - 1;

  const frozenMultiplier = gearFrozenDamageMultiplier(state);
  if (frozenMultiplier !== 1) bonus += frozenMultiplier - 1;

  const burnBonusToBleeding = computeBurnMultiplier(effect, state);
  if (burnBonusToBleeding !== 1) bonus += burnBonusToBleeding - 1;

  return bonus;
}

function computeAdditiveDamageBonus(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
): number {
  return (
    computeEffectBonusMultiplier(effect, state) +
    computeTypeSpecificDamageBonus(state, effect) +
    computeCardSpecificTalentBonus(state, effect, card) +
    computeExternalDamageMultipliers(state, effect)
  );
}

export function applyFirstDamageBonus(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
): { state: BattleState; firstBonus: number } {
  let nextState: BattleState = state;
  let firstBonus = 0;

  if (isBurnLikeDamage(effect.damageType, state)) {
    if (
      nextState.talentEffects.firstBurnCardBonusMultiplier > 1 &&
      !readCombatFlag(nextState, "firstBurnCardDoubledUsed")
    ) {
      firstBonus += nextState.talentEffects.firstBurnCardBonusMultiplier - 1;
      nextState = setFlag(nextState, "firstBurnCardDoubledUsed", true);
    }
    if (nextState.trinketEffects.firstBurnDoubled && !readCombatFlag(nextState, "firstBurnTrinketDoubledUsed")) {
      firstBonus += 1;
      nextState = setFlag(nextState, "firstBurnTrinketDoubledUsed", true);
    }
  }

  return { state: nextState, firstBonus };
}

function computeBurnMultiplier(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleState): number {
  if (!isBurnLikeDamage(effect.damageType, state)) return 1;
  return getBurnBonusToBleedingMultiplier(state);
}

export function resolveDamageBonusMultiplier(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  {
    card,
    firstBonus,
    companionAttack = false,
  }: {
    card?: BattleCard | undefined;
    firstBonus: number;
    companionAttack?: boolean;
  },
): number {
  const unwoundedBonus =
    isBleedLikeDamage(effect.damageType, state) && state.enemyStatuses.bleed === 0
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
  const totalBonus = computeAdditiveDamageBonus(state, effect, card) + firstBonus + unwoundedBonus + cullBonus;
  return Math.max(MIN_DAMAGE_MULTIPLIER, 1 + totalBonus);
}
