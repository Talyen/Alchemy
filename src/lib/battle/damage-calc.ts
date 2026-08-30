import {
  getBurnBonusToBleedingMultiplier,
  getEnemyDamageMultiplier,
  getBattleRng,
  rollPercent,
} from "./status-helpers";
import { gearFrozenDamageMultiplier } from "./gear-effects";
import { scalePercent, scalePerMana } from "./amount-helpers";
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
    const goldDamage = scalePercent(state.gold, effect.equalToGoldPercent, PERCENT_DENOMINATOR);
    return goldDamage + forgeBonus;
  }
  let amount = effect.amount + forgeBonus;
  if (effect.doubleIfEnemyBurning && state.enemyStatuses.burn > 0) {
    amount *= 2;
  }
  if (effect.tripleIfEnemyNotBurning && state.enemyStatuses.burn === 0) {
    amount *= 3;
  }
  if (card?.tags?.includes("archery")) {
    amount += state.talentEffects.flatArrowDamage + state.gearEffects.flatArrowDamage;
  }
  return amount;
}

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

function doublingActive(flag: boolean, cc: number): boolean {
  return flag && cc > 0;
}

function isBelowHalfHealth(state: BattleState): boolean {
  return state.playerHealth * HALF_DIVISOR <= state.playerMaxHealth;
}

function applyConsumeBonus(amount: number, state: BattleState, card?: BattleCard): number {
  if (!card?.consume || state.talentEffects.consumeDamageBonusPercent <= 0) return amount;
  return Math.round(amount * (1 + state.talentEffects.consumeDamageBonusPercent / PERCENT_DENOMINATOR));
}

function applyPhysicalCCAndStatusMultipliers(state: BattleState, amount: number): number {
  let nextAmount = amount;
  if (doublingActive(state.talentEffects.physicalDoubledVsStunned, state.enemyCC.stunSkipTurns)) nextAmount *= 2;
  if (doublingActive(state.talentEffects.physicalDoubledVsFrozen, state.enemyCC.freezeSkipTurns)) nextAmount *= 2;
  if (isBelowHalfHealth(state) && state.talentEffects.physicalDoubledBelowHalfHealth) nextAmount *= 2;
  if (state.enemyStatuses.poison > 0) nextAmount += state.talentEffects.poisonPhysicalBonus;
  if (state.enemyStatuses.bleed > 0) nextAmount += state.talentEffects.bleedPhysicalBonus;
  return nextAmount;
}

function applyPhysicalDamageModifiers(state: BattleState, rawAmount: number): number {
  const scaledAmount = applyPhysicalScaling(state, rawAmount);
  return applyPhysicalCCAndStatusMultipliers(state, scaledAmount);
}

function applyHolyDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.gearEffects.flatHolyDamage;
  nextAmount += scalePercent(state.gold, state.talentEffects.holyGoldPercent, PERCENT_DENOMINATOR);
  nextAmount += scalePercent(
    state.playerStatuses.block,
    state.gearEffects.holyDamageFromBlockPercent,
    PERCENT_DENOMINATOR,
  );
  nextAmount += scalePercent(state.gold, state.gearEffects.holyDamageFromGoldPercent, PERCENT_DENOMINATOR);
  if (state.talentEffects.blockToHolyDamage) {
    nextAmount += getPlayerBlockHalf(state);
  }
  if (state.enemyStatuses.burn > 0) {
    nextAmount = Math.round(nextAmount * (1 + state.talentEffects.holyVsBurnMultiplier / PERCENT_DENOMINATOR));
  }
  return nextAmount;
}

function applyBleedDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.gearEffects.flatBleedDamage;
  if (isBelowHalfHealth(state) && state.talentEffects.bleedDesperateMultiplier > 1) {
    nextAmount = Math.round(nextAmount * state.talentEffects.bleedDesperateMultiplier);
  }
  if (
    state.talentEffects.bleedExecuteThreshold > 0 &&
    state.enemyHealth * PERCENT_DENOMINATOR <= state.enemyMaxHealth * state.talentEffects.bleedExecuteThreshold
  ) {
    nextAmount = Math.round(nextAmount * state.talentEffects.bleedExecuteMultiplier);
  }
  return nextAmount;
}

function applyStunDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatStunDamage + state.gearEffects.flatStunDamage;
  if (state.talentEffects.blockToStunDamage) {
    nextAmount += scalePercent(state.playerStatuses.block, BLOCK_SCALED_DAMAGE_PERCENT, PERCENT_DENOMINATOR);
  }
  return nextAmount;
}

function applyBurnDamageModifiers(state: BattleState, rawAmount: number, card?: BattleCard): number {
  let nextAmount = rawAmount + state.talentEffects.flatBurnDamage + state.gearEffects.flatBurnDamage;
  if (state.talentEffects.burnDamagePerManaCrystal > 0) {
    nextAmount += scalePerMana(state.maxMana, state.talentEffects.burnDamagePerManaCrystal, "percent");
  }
  if (state.gearEffects.burnDamagePerManaPercent > 0) {
    nextAmount += scalePerMana(state.maxMana, state.gearEffects.burnDamagePerManaPercent, "percent");
  }
  if (state.talentEffects.blockToBurnDamage) {
    nextAmount += scalePercent(state.playerStatuses.block, BURN_BLOCK_SCALED_DAMAGE_PERCENT, PERCENT_DENOMINATOR);
  }
  if (card?.consume && state.talentEffects.consumeBurnDamageBonusPercent > 0) {
    nextAmount = Math.round(nextAmount * (1 + state.talentEffects.consumeBurnDamageBonusPercent / PERCENT_DENOMINATOR));
  }
  return nextAmount;
}

function applyFreezeDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatFreezeDamage + state.gearEffects.flatFreezeDamage;
  if (state.talentEffects.freezeDamagePerManaCrystal > 0) {
    nextAmount += scalePerMana(state.maxMana, state.talentEffects.freezeDamagePerManaCrystal, "half");
  }
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

const DAMAGE_TYPE_HANDLERS: Record<DamageType, DamageTypeHandler> = {
  physical: applyPhysicalDamageModifiers,
  holy: applyHolyDamageModifiers,
  bleed: applyBleedDamageModifiers,
  stun: applyStunDamageModifiers,
  burn: applyBurnDamageModifiers,
  freeze: applyFreezeDamageModifiers,
  nature: applyNatureDamageModifiers,
  poison: applyPoisonDamageModifiers,
} satisfies Record<DamageType, DamageTypeHandler>;

function computeBaseDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
) {
  const rawAmount = computeBaseRawAmount(state, effect, card);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean flags; || is correct for false vs undefined.
  const isEqualTo = Boolean(effect.equalToBlock || effect.equalToArmor || effect.equalToGoldPercent);
  if (isEqualTo) return Math.max(0, applyConsumeBonus(rawAmount, state, card));
  const modifier = DAMAGE_TYPE_HANDLERS[effect.damageType];
  if (!modifier) throw new Error(`Missing DamageType handler: ${effect.damageType}`);
  return Math.max(0, applyConsumeBonus(modifier(state, rawAmount, card), state, card));
}

function applyCrit(damage: number, state: BattleState) {
  if (state.flags.nextHitCrit) return damage * CRIT_MULTIPLIER;
  return rollPercent(GLOBAL_CRIT_CHANCE, getBattleRng(state)) ? damage * CRIT_MULTIPLIER : damage;
}

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

function applySunderingArmorPiercing(state: BattleState, isPhysicalOrStun: boolean, card?: BattleCard): BattleState {
  if (!isPhysicalOrStun) return state;
  let pierce = state.trinketEffects.sunderingArmorPiercing + state.gearEffects.armorPiercing;
  if (card?.tags?.includes("archery")) {
    pierce += state.gearEffects.archeryArmorPiercing + state.talentEffects.archeryArmorPiercing;
  }
  if (pierce <= 0) return state;
  return reduceEnemyArmor(state, pierce);
}

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
  const talentEffects = state.talentEffects;
  if (doublingActive(talentEffects.archeryDoubledVsStunned, cc.stunSkipTurns)) return damage * 2;
  if (doublingActive(talentEffects.archeryDoubledVsFrozen, cc.freezeSkipTurns)) return damage * 2;
  if (
    talentEffects.archeryDoubledVsHighHealth &&
    state.enemyHealth * PERCENT_DENOMINATOR > state.enemyMaxHealth * ARCHERY_HIGH_HEALTH_THRESHOLD_PERCENT
  )
    return damage * 2;
  if (
    talentEffects.archeryDoubledVsLowHealth &&
    state.enemyHealth * PERCENT_DENOMINATOR <= state.enemyMaxHealth * LOW_HEALTH_THRESHOLD_PERCENT
  )
    return damage * 2;
  return damage;
}

function computeBurnMultiplier(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleState): number {
  if (effect.damageType !== "burn") return 1;
  return getBurnBonusToBleedingMultiplier(state);
}

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
