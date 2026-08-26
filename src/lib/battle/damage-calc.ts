/**
 * Player damage calculation: per-type base amounts, first-card modifiers, crit, block, and armor mitigation.
 */
import { getBurnBonusToBleedingMultiplier, getEnemyDamageMultiplier, getBattleRng } from "./status-helpers";
import { gearFrozenDamageMultiplier } from "./gear-effects";
import { type BattleCard, type BattleCardEffect, type DamageType, type TalentEffectManifest } from "@/lib/game-data";
import { reduceEnemyArmor, setFlag, type BattleState } from "./types";
import { paceCombatMagnitude } from "./fight-pacing";
import {
  ARCHERY_HIGH_HEALTH_THRESHOLD_PERCENT,
  BLOCK_SCALED_DAMAGE_PERCENT,
  BURN_BLOCK_SCALED_DAMAGE_PERCENT,
  LOW_HEALTH_THRESHOLD_PERCENT,
  CRIT_MULTIPLIER,
  FIRST_EFFECT_MULTIPLIER,
  GLOBAL_CRIT_CHANCE,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
} from "../game-constants";

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
 * Calculates raw base damage amount before keyword specific modifiers are applied.
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
  if (effect.doubleIfEnemyBurning && state.enemyStatuses.burn > 0) {
    amount *= 2;
  }
  if (card?.tags?.includes("archery")) {
    amount += state.talentEffects.flatArrowDamage + state.gearEffects.flatArrowDamage;
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
  if (state.enemyCC.stunSkipTurns > 0 && state.talentEffects.physicalDoubledVsStunned) {
    nextAmount *= 2;
  }
  if (state.enemyCC.freezeSkipTurns > 0 && state.talentEffects.physicalDoubledVsFrozen) {
    nextAmount *= 2;
  }
  if (
    state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR &&
    state.talentEffects.physicalDoubledBelowHalfHealth
  ) {
    nextAmount *= 2;
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
  nextAmount += Math.round(
    (state.playerStatuses.block * state.gearEffects.holyDamageFromBlockPercent) / PERCENT_DENOMINATOR,
  );
  nextAmount += Math.round((state.gold * state.gearEffects.holyDamageFromGoldPercent) / PERCENT_DENOMINATOR);
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
  if (
    state.talentEffects.bleedExecuteThreshold > 0 &&
    state.enemyHealth <= (state.enemyMaxHealth * state.talentEffects.bleedExecuteThreshold) / PERCENT_DENOMINATOR
  ) {
    nextAmount = Math.round(nextAmount * state.talentEffects.bleedExecuteMultiplier);
  }
  return nextAmount;
}

function getBlockScaledDamageBonus(state: BattleState, percent = BLOCK_SCALED_DAMAGE_PERCENT): number {
  return Math.round((state.playerStatuses.block * percent) / PERCENT_DENOMINATOR);
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
    nextAmount += Math.round((state.maxMana * state.talentEffects.burnDamagePerManaCrystal) / PERCENT_DENOMINATOR);
  }
  if (state.gearEffects.burnDamagePerManaPercent > 0) {
    nextAmount += Math.round((state.maxMana * state.gearEffects.burnDamagePerManaPercent) / PERCENT_DENOMINATOR);
  }
  if (state.talentEffects.blockToBurnDamage) {
    nextAmount += getBlockScaledDamageBonus(state, BURN_BLOCK_SCALED_DAMAGE_PERCENT);
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
  let nextAmount = rawAmount + state.talentEffects.flatNatureDamage + state.gearEffects.flatNatureDamage;
  if (state.talentEffects.armorToNatureDamage) {
    nextAmount += state.playerStatuses.armor;
  }
  if (state.enemyStatuses.poison > 0) {
    nextAmount += state.talentEffects.natureBonusVsPoisoned;
  }
  return nextAmount;
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
  physical: applyPhysicalDamageModifiers,
  holy: applyHolyDamageModifiers,
  bleed: applyBleedDamageModifiers,
  stun: applyStunDamageModifiers,
  burn: applyBurnDamageModifiers,
  freeze: applyFreezeDamageModifiers,
  nature: applyNatureDamageModifiers,
  poison: applyPoisonDamageModifiers,
};

function computeBaseDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
) {
  const rawAmount = computeBaseRawAmount(state, effect, card);
  const modifier = DAMAGE_TYPE_HANDLERS[effect.damageType] ?? ((_s, r) => r);
  let amount = modifier(state, rawAmount, card);
  if (card?.consume && state.talentEffects.consumeDamageBonusPercent > 0) {
    amount = Math.round(amount * (1 + state.talentEffects.consumeDamageBonusPercent / PERCENT_DENOMINATOR));
  }
  return Math.max(0, amount);
}

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
  if (cc.stunSkipTurns > 0 && talent.archeryDoubledVsStunned) return damage * 2;
  if (cc.freezeSkipTurns > 0 && talent.archeryDoubledVsFrozen) return damage * 2;
  if (
    talent.archeryDoubledVsHighHealth &&
    state.enemyHealth > (state.enemyMaxHealth * ARCHERY_HIGH_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR
  ) {
    return damage * 2;
  }
  if (
    talent.archeryDoubledVsLowHealth &&
    state.enemyHealth <= (state.enemyMaxHealth * LOW_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR
  ) {
    return damage * 2;
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
  const stateWithCritCleared = stateAfterBlock.flags.nextHitCrit
    ? setFlag(stateAfterBlock, "nextHitCrit", false)
    : stateAfterBlock;
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";
  const nextState = applySunderingArmorPiercing(stateWithCritCleared, isPhysicalOrStun, card);
  const effectiveArmor = isPhysicalOrStun ? nextState.enemyMitigation.armor : 0;
  const damageAfterArmor = Math.max(0, damageAfterBlock - effectiveArmor);
  const multiplier =
    getEnemyDamageMultiplier(nextState, effect.damageType) *
    gearFrozenDamageMultiplier(nextState) *
    computeBurnMultiplier(effect, nextState);
  return { nextState, modifiedDamage: Math.round(damageAfterArmor * multiplier) };
}
