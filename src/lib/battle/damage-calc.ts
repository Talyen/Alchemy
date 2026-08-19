/**
 * Player damage calculation: modifiers, crit, block, and armor mitigation, critical strikes, armor mitigation, and status riders.
 * Depends on: ./status-helpers, ./combat-text, ./trinket-effects, ./wish, ./types, ../game-constants.
 * Depended on by: ./damage, ./damage-riders.
 */
import { getBurnBonusToBleedingMultiplier, getEnemyDamageMultiplier } from "./status-helpers";
import { gearFrozenDamageMultiplier } from "./gear-effects";
import { getBattleRng } from "./status-helpers";
import { computeBaseDamage } from "./damage-calc/damage-type-modifiers";
import { type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import { reduceEnemyArmor, setFlag, type BattleState } from "./types";
import { paceCombatMagnitude } from "./fight-pacing";
import {
  ARCHERY_HIGH_HEALTH_THRESHOLD_PERCENT,
  COMPANION_LOW_HEALTH_THRESHOLD_PERCENT,
  CRIT_MULTIPLIER,
  FIRST_EFFECT_MULTIPLIER,
  GLOBAL_CRIT_CHANCE,
  PERCENT_DENOMINATOR,
} from "../game-constants";
export { forgeAppliesToDamageType } from "./damage-calc/damage-type-modifiers";
const DAMAGE_CONSTANTS = {
  DOUBLE_MULTIPLIER: 2,
};
/**
 * Evaluates whether damage turns into a critical strike and returns modified damage.
 */
function applyCrit(damage: number, state: BattleState) {
  if (state.flags.nextHitCrit) return damage * CRIT_MULTIPLIER;
  const totalChance = GLOBAL_CRIT_CHANCE;
  const rng = getBattleRng(state);
  const isCrit = totalChance > 0 && rng() * PERCENT_DENOMINATOR < totalChance;
  return isCrit ? damage * CRIT_MULTIPLIER : damage;
}

/**
 * Applies first-card element doubling modifiers (burn, holy), updating state with consumed flags.
 */
function applyFirstDamageModifiers(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  rawDamage: number,
): { state: BattleState; rawDamage: number } {
  let nextState: BattleState = state;
  let nextDamage = rawDamage;

  if (effect.damageType === "burn") {
    if (nextState.talentEffects.firstBurnCardBonusMultiplier > 1 && !nextState.flags.firstBurnCardDoubledUsed) {
      nextDamage = Math.round(nextDamage * nextState.talentEffects.firstBurnCardBonusMultiplier);
      nextState = setFlag(nextState, "firstBurnCardDoubledUsed", true);
    }
    if (nextState.trinketEffects.firstBurnDoubled && !nextState.flags.firstBurnTrinketDoubledUsed) {
      nextDamage *= FIRST_EFFECT_MULTIPLIER;
      nextState = setFlag(nextState, "firstBurnTrinketDoubledUsed", true);
    }
  } else if (effect.damageType === "holy") {
    if (nextState.trinketEffects.firstHolyDamageDoubled && !nextState.flags.firstHolyDamageBonusUsed) {
      nextDamage *= FIRST_EFFECT_MULTIPLIER;
      nextState = setFlag(nextState, "firstHolyDamageBonusUsed", true);
    }
  }

  return { state: nextState, rawDamage: nextDamage };
}

/**
 * Resolves boon-based stun triggers from playing high physical/stun damage with active forge stacks.
 */
function applySunderingArmorPiercing(state: BattleState, isPhysicalOrStun: boolean, card?: BattleCard): BattleState {
  if (!isPhysicalOrStun) return state;
  let pierce = state.trinketEffects.sunderingArmorPiercing + state.gearEffects.armorPiercing;
  if (card?.tags?.includes("archery")) {
    pierce += state.gearEffects.archeryArmorPiercing + state.talentEffects.archeryArmorPiercing;
  }
  if (pierce <= 0) return state;
  return reduceEnemyArmor(state, pierce);
}

// Returns { state, remainingDamage } because block absorption produces TWO distinct
// outputs consumed by the caller: the updated state and the damage value after block.
// Functions that only modify state inline (consumeForgeAfterDamage, applySunderingArmorPiercing)
// return just BattleState.
function applyBlockAbsorption(state: BattleState, damage: number): { state: BattleState; remainingDamage: number } {
  const effectiveBlock = state.enemyMitigation.block;
  const blockAbsorbed = Math.min(damage, effectiveBlock);
  const remainingDamage = Math.max(0, damage - blockAbsorbed);
  let nextState = state;
  if (blockAbsorbed > 0) {
    nextState = {
      ...nextState,
      enemyMitigation: {
        ...nextState.enemyMitigation,
        block: nextState.enemyMitigation.block - blockAbsorbed,
      },
    };
  }
  return { state: nextState, remainingDamage };
}

function applyArcheryMultiplier(damage: number, state: BattleState): number {
  const cc = state.enemyCC;
  const talent = state.talentEffects;
  if (cc.stunSkipTurns > 0 && talent.archeryDoubledVsStunned) return damage * DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  if (cc.freezeSkipTurns > 0 && talent.archeryDoubledVsFrozen) return damage * DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  if (
    talent.archeryDoubledVsHighHealth &&
    state.enemyHealth > (state.enemyMaxHealth * ARCHERY_HIGH_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR
  ) {
    return damage * DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  }
  if (
    talent.archeryDoubledVsLowHealth &&
    state.enemyHealth <= (state.enemyMaxHealth * COMPANION_LOW_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR
  ) {
    return damage * DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  }
  return damage;
}

function computeBurnMultiplier(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleState): number {
  if (effect.damageType !== "burn") return 1;
  return getBurnBonusToBleedingMultiplier(state);
}

/**
 * Computes final adjusted damage to the enemy, considering critical strikes, traits, and armor reduction.
 */
export function computeCardDamageToEnemy(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
) {
  const baseDamage = computeBaseDamage(state, effect, card);
  const { state: stateAfterFirstMods, rawDamage } = applyFirstDamageModifiers(state, effect, baseDamage);
  const pacedDamage = paceCombatMagnitude(stateAfterFirstMods, rawDamage, "player");
  let finalDamage = applyCrit(pacedDamage, stateAfterFirstMods);
  if (card?.tags?.includes("archery")) finalDamage = applyArcheryMultiplier(finalDamage, stateAfterFirstMods);

  const { state: stateAfterBlock, remainingDamage: damageAfterBlock } = applyBlockAbsorption(
    stateAfterFirstMods,
    finalDamage,
  );
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";
  const nextState = applySunderingArmorPiercing(stateAfterBlock, isPhysicalOrStun, card);
  const effectiveArmor = isPhysicalOrStun ? nextState.enemyMitigation.armor : 0;
  const damageAfterArmor = Math.max(0, damageAfterBlock - effectiveArmor);
  const multiplier =
    getEnemyDamageMultiplier(nextState, effect.damageType) *
    gearFrozenDamageMultiplier(nextState) *
    computeBurnMultiplier(effect, nextState);
  return { nextState, modifiedDamage: Math.round(damageAfterArmor * multiplier) };
}
