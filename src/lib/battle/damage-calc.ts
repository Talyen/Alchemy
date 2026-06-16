/**
 * Player damage calculation: modifiers, crit, block, and armor mitigation, critical strikes, armor mitigation, and status riders.
 * Depends on: ./status-effects, ./combat-text, ./trinket-effects, ./wish, ./types, ../game-constants.
 * Depended on by: ./apply-effects.
 */
import { getEnemyDamageMultiplier } from "./status-effects";
import { getBattleRng } from "./status-helpers";
import { type BattleCard, type BattleCardEffect, type DamageType, type TalentEffectManifest } from "@/lib/game-data";
import { reduceEnemyArmor, setFlag, type BattleState } from "./types";
import {
  BLEED_EXECUTE_MULTIPLIER,
  BLOCK_SCALED_DAMAGE_PERCENT,
  CRIT_MULTIPLIER,
  MANA_BURN_DAMAGE_PERCENT,
  FIRST_BURN_CARD_BONUS_MULTIPLIER,
  FIRST_EFFECT_MULTIPLIER,
  GLOBAL_CRIT_CHANCE,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
} from "../game-constants";
const DAMAGE_CONSTANTS = {
  DOUBLE_MULTIPLIER: 2,
};

export function forgeAppliesToDamageType(damageType: DamageType, talentEffects: TalentEffectManifest): boolean {
  return (
    damageType === "physical" ||
    damageType === "stun" ||
    (damageType === "burn" && talentEffects.forgeToBurn) ||
    (damageType === "holy" && talentEffects.forgeToHoly) ||
    (damageType === "bleed" && talentEffects.forgeToBleed)
  );
}

function getPlayerBlockHalf(state: BattleState): number {
  return Math.round(state.playerStatuses.block / HALF_DIVISOR);
}

/**
 * Calculates raw base damage amount before any keyword specific modifiers are applied.
 * Evaluates forge bonus and whether the damage scales on current block or armor.
 */
function getForgeBonusForDamage(state: BattleState, damageType: DamageType): number {
  if (!forgeAppliesToDamageType(damageType, state.talentEffects)) return 0;
  const forge = state.playerStatuses.forge;
  if (damageType === "physical" && state.talentEffects.forgeToPhysicalDamageMultiplier > 0) {
    return forge * state.talentEffects.forgeToPhysicalDamageMultiplier;
  }
  return forge;
}

function computeBaseRawAmount(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
): number {
  const forgeBonus = getForgeBonusForDamage(state, effect.damageType);

  if (effect.equalToBlock) {
    return state.playerStatuses.block + forgeBonus;
  }
  if (effect.equalToArmor) {
    return state.playerStatuses.armor + forgeBonus;
  }
  if (effect.equalToGoldPercent) {
    const goldDamage = Math.round((state.gold * effect.equalToGoldPercent) / PERCENT_DENOMINATOR);
    return goldDamage + forgeBonus;
  }
  let amount = effect.amount + forgeBonus;
  if (card?.tags?.includes("archery")) {
    amount += state.talentEffects.flatArrowDamage;
  }
  return amount;
}

/**
 * Applies physical damage modifiers from character talent effects.
 * Takes into account flat bonus, armor/block scaling, stunned/frozen multipliers, and bleed/poison status bonuses.
 */
function applyPhysicalScaling(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatPhysicalDamage + state.gearEffects.flatPhysicalDamage;
  if (state.talentEffects.armorToPhysicalDamage) {
    nextAmount += state.playerStatuses.armor;
  }
  if (state.talentEffects.blockToPhysicalDamageMultiplier > 0) {
    nextAmount += Math.round(state.playerStatuses.block * state.talentEffects.blockToPhysicalDamageMultiplier);
  }
  return nextAmount;
}

function applyPhysicalCCAndStatusMultipliers(state: BattleState, amount: number): number {
  let nextAmount = amount;
  if (state.enemyStunSkipTurns > 0 && state.talentEffects.physicalDoubledVsStunned) {
    nextAmount *= DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  }
  if (state.enemyFreezeSkipTurns > 0 && state.talentEffects.physicalDoubledVsFrozen) {
    nextAmount *= DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  }
  if (
    state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR &&
    state.talentEffects.physicalDoubledBelowHalfHealth
  ) {
    nextAmount *= DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  }
  if (state.enemyStatuses.poison > 0) {
    nextAmount += state.talentEffects.poisonPhysicalBonus;
  }
  if (state.enemyStatuses.bleed > 0) {
    nextAmount += state.talentEffects.bleedPhysicalBonus;
  }
  return nextAmount;
}

function applyPhysicalDamageModifiers(state: BattleState, rawAmount: number): number {
  const scaledAmount = applyPhysicalScaling(state, rawAmount);
  return applyPhysicalCCAndStatusMultipliers(state, scaledAmount);
}

/**
 * Applies holy damage modifiers based on player gold and current block.
 * Amplifies output if the target is currently afflicted with burn.
 */
function applyHolyDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.gearEffects.flatHolyDamage;
  nextAmount += Math.round((state.gold * state.talentEffects.holyGoldPercent) / PERCENT_DENOMINATOR);
  nextAmount += Math.round((state.playerStatuses.block * state.talentEffects.holyBlockPercent) / PERCENT_DENOMINATOR);
  if (state.talentEffects.blockToHolyDamage) {
    nextAmount += getPlayerBlockHalf(state);
  }
  if (state.enemyStatuses.burn > 0) {
    nextAmount = Math.round(nextAmount * (1 + state.talentEffects.holyVsBurnMultiplier / PERCENT_DENOMINATOR));
  }
  return nextAmount;
}

/**
 * Applies bleed damage modifiers, including desperation below half health and execute bonuses.
 */
function applyBleedDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.gearEffects.flatBleedDamage;
  if (state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR && state.talentEffects.bleedDesperateMultiplier > 1) {
    nextAmount = Math.round(nextAmount * state.talentEffects.bleedDesperateMultiplier);
  }
  if (state.enemyHealth <= (state.enemyMaxHealth * state.talentEffects.bleedExecuteThreshold) / PERCENT_DENOMINATOR) {
    nextAmount = Math.round(nextAmount * BLEED_EXECUTE_MULTIPLIER);
  }
  return nextAmount;
}

function getBlockScaledDamageBonus(state: BattleState): number {
  return Math.round((state.playerStatuses.block * BLOCK_SCALED_DAMAGE_PERCENT) / PERCENT_DENOMINATOR);
}

function applyStunDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatStunDamage + state.gearEffects.flatStunDamage;
  if (state.talentEffects.blockToStunDamage) {
    nextAmount += getBlockScaledDamageBonus(state);
  }
  return nextAmount;
}

function applyBurnDamageModifiers(state: BattleState, rawAmount: number, card?: BattleCard): number {
  let nextAmount = rawAmount + state.talentEffects.flatBurnDamage + state.gearEffects.flatBurnDamage;
  if (state.talentEffects.burnDamagePerManaCrystal > 0) {
    nextAmount += Math.round(
      (state.maxMana * state.talentEffects.burnDamagePerManaCrystal * MANA_BURN_DAMAGE_PERCENT) / PERCENT_DENOMINATOR,
    );
  }
  if (state.talentEffects.blockToBurnDamage) {
    nextAmount += getBlockScaledDamageBonus(state);
  }
  if (card?.consume && state.talentEffects.consumeBurnDamageBonusPercent > 0) {
    nextAmount = Math.round(nextAmount * (1 + state.talentEffects.consumeBurnDamageBonusPercent / PERCENT_DENOMINATOR));
  }
  return nextAmount;
}

function applyFreezeDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatFreezeDamage + state.gearEffects.flatFreezeDamage;
  nextAmount += Math.round((state.maxMana * state.talentEffects.freezeDamagePerManaCrystal) / HALF_DIVISOR);
  return nextAmount;
}

function applyNatureDamageModifiers(state: BattleState, rawAmount: number): number {
  return rawAmount + state.talentEffects.flatNatureDamage + state.gearEffects.flatNatureDamage;
}

function applyPoisonDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.gearEffects.flatPoisonDamage;
  if (state.enemyStatuses.bleed > 0) {
    nextAmount += state.talentEffects.bleedPoisonDamageTakenBonus;
  }
  return nextAmount;
}

type DamageTypeHandler = (state: BattleState, rawAmount: number, card?: BattleCard) => number;

const DAMAGE_TYPE_HANDLERS: Record<string, DamageTypeHandler> = {
  physical: (s, r) => applyPhysicalDamageModifiers(s, r),
  holy: (s, r) => applyHolyDamageModifiers(s, r),
  bleed: (s, r) => applyBleedDamageModifiers(s, r),
  stun: (s, r) => applyStunDamageModifiers(s, r),
  burn: (_s, r, c) => applyBurnDamageModifiers(_s, r, c),
  freeze: (s, r) => applyFreezeDamageModifiers(s, r),
  nature: (s, r) => applyNatureDamageModifiers(s, r),
  poison: (s, r) => applyPoisonDamageModifiers(s, r),
};

function computeBaseDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
) {
  const rawAmount = computeBaseRawAmount(state, effect, card);
  const modifier = DAMAGE_TYPE_HANDLERS[effect.damageType] ?? ((_s, r) => r);
  return Math.max(0, modifier(state, rawAmount, card));
}

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
function applySunderingArmorPiercing(state: BattleState, isPhysicalOrStun: boolean): BattleState {
  if (isPhysicalOrStun) {
    return reduceEnemyArmor(state, state.trinketEffects.sunderingArmorPiercing);
  }
  return state;
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
  const finalDamage = applyCrit(rawDamage, effect.damageType, stateAfterFirstMods);

  const { state: stateAfterBlock, remainingDamage: damageAfterBlock } = applyBlockAbsorption(
    stateAfterFirstMods,
    finalDamage,
  );
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";

  const nextState = applySunderingArmorPiercing(stateAfterBlock, isPhysicalOrStun);
  const effectiveArmor = isPhysicalOrStun ? nextState.enemyMitigation.armor : 0;
  const damageAfterArmor = Math.max(0, damageAfterBlock - effectiveArmor);
  const multiplier = getEnemyDamageMultiplier(stateAfterFirstMods, effect.damageType);
  return { nextState, modifiedDamage: Math.round(damageAfterArmor * multiplier) };
}
