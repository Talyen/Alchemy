/**
 * Player damage calculation: modifiers, crit, block, and armor mitigation, critical strikes, armor mitigation, and status riders.
 * Depends on: ./status-effects, ./combat-text, ./trinket-effects, ./wish, ./types, ../game-constants.
 * Depended on by: ./apply-effects.
 */
import { getEnemyDamageMultiplier } from "./status-effects";
import { gearFrozenDamageMultiplier } from "./gear-effects";
import { getBattleRng } from "./status-helpers";
import { computeBaseDamage } from "./damage-calc/damage-type-modifiers";
import { type BattleCard, type BattleCardEffect, type DamageType } from "@/lib/game-data";
import { reduceEnemyArmor, setFlag, type BattleState } from "./types";
import {
  CRIT_MULTIPLIER,
  FIRST_BURN_CARD_BONUS_MULTIPLIER,
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
function applyCrit(damage: number, damageType: DamageType, state: BattleState) {
  const physCritChance = damageType === "physical" ? state.talentEffects.physicalCritChance : 0;
  const totalChance = GLOBAL_CRIT_CHANCE + physCritChance;
  const rng = getBattleRng(state);
  const isCrit = totalChance > 0 && rng() * PERCENT_DENOMINATOR < totalChance;
  return isCrit ? damage * CRIT_MULTIPLIER : damage;
}

function applyFirstBurnModifiers(state: BattleState, rawDamage: number): { state: BattleState; damage: number } {
  let nextState: BattleState = state;
  let nextDamage = rawDamage;

  if (nextState.talentEffects.firstBurnCardDoubled && !nextState.flags.firstBurnCardDoubledUsed) {
    nextDamage = Math.round(nextDamage * FIRST_BURN_CARD_BONUS_MULTIPLIER);
    nextState = setFlag(nextState, "firstBurnCardDoubledUsed", true);
  }
  if (nextState.trinketEffects.firstBurnDoubled && !nextState.flags.firstBurnTrinketDoubledUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstBurnTrinketDoubledUsed", true);
  }

  return { state: nextState, damage: nextDamage };
}

/**
 * Applies first-time holy modifiers from boons, updating state in place.
 */
function applyFirstHolyModifiers(state: BattleState, rawDamage: number): { state: BattleState; damage: number } {
  let nextState: BattleState = state;
  let nextDamage = rawDamage;

  if (nextState.trinketEffects.firstHolyDamageDoubled && !nextState.flags.firstHolyDamageBonusUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstHolyDamageBonusUsed", true);
  }

  return { state: nextState, damage: nextDamage };
}

/**
 * Applies first-card doubling modifiers, updating state with consumed flags.
 */
function applyFirstDamageModifiers(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  rawDamage: number,
): { state: BattleState; rawDamage: number } {
  if (effect.damageType === "burn") {
    const { state: nextState, damage } = applyFirstBurnModifiers(state, rawDamage);
    return { state: nextState, rawDamage: damage };
  }
  if (effect.damageType === "holy") {
    const { state: nextState, damage } = applyFirstHolyModifiers(state, rawDamage);
    return { state: nextState, rawDamage: damage };
  }
  return { state, rawDamage };
}

/**
 * Resolves boon-based stun triggers from playing high physical/stun damage with active forge stacks.
 */
function applySunderingArmorPiercing(state: BattleState, isPhysicalOrStun: boolean, card?: BattleCard): BattleState {
  if (!isPhysicalOrStun) return state;
  let pierce = state.trinketEffects.sunderingArmorPiercing + state.gearEffects.armorPiercing;
  if (card?.tags?.includes("archery")) {
    pierce += state.gearEffects.archeryArmorPiercing;
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
  if (state.enemyHealth >= state.enemyMaxHealth && talent.archeryDoubledVsHighHealth)
    return damage * DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  return damage;
}

function computeBurnMultiplier(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleState): number {
  if (
    effect.damageType !== "burn" ||
    state.enemyStatuses.bleed <= 0 ||
    state.gearEffects.burnDamageBonusToBleedingPercent <= 0
  )
    return 1;
  return 1 + state.gearEffects.burnDamageBonusToBleedingPercent / PERCENT_DENOMINATOR;
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
  let finalDamage = applyCrit(rawDamage, effect.damageType, stateAfterFirstMods);
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
    getEnemyDamageMultiplier(stateAfterFirstMods, effect.damageType) *
    gearFrozenDamageMultiplier(stateAfterFirstMods) *
    computeBurnMultiplier(effect, stateAfterFirstMods);
  return { nextState, modifiedDamage: Math.round(damageAfterArmor * multiplier) };
}
