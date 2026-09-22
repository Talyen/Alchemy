import { readCombatFlag } from "./action-context";
import {
  isPotionCard,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
  type TalentEffectManifest,
} from "@/lib/game-data";
import {
  ARCHERY_FULL_HEALTH_THRESHOLD_PERCENT,
  ARCHERY_LOW_HEALTH_THRESHOLD_PERCENT,
  BLOCK_SCALED_DAMAGE_PERCENT,
  BURN_BLOCK_SCALED_DAMAGE_PERCENT,
  HALF_DIVISOR,
  MIN_DAMAGE_MULTIPLIER,
  PERCENT_DENOMINATOR,
} from "../game-constants";
import { scalePercent, scalePerMana } from "./amount-helpers";
import { cardHasKeyword } from "./card-classification";
import { flatDamageBonus } from "./damage-modifiers";
import { gearFrozenDamageMultiplier } from "./gear-effects";
import {
  getBurnBonusToBleedingMultiplier,
  getEnemyDamageMultiplier,
  getPoisonBonusAgainstBleeding,
  getPoisonDamageMultiplierAgainstBleeding,
} from "./status-helpers";
import { setFlag, type BattleState } from "./types";

function forgeDamagePercent(
  damageType: DamageType,
  talents: TalentEffectManifest,
  gear?: BattleState["gearEffects"],
  companionAttack = false,
): number {
  if (companionAttack && (gear?.companionBenefitsFromForge ?? 0) > 0) return PERCENT_DENOMINATOR;
  // Full-strength Homestead/Gear grants and legacy snapshot flags take precedence;
  // overlapping permissions do not award Forge twice.
  const burn = Math.max(
    talents.forgeToBurn ? PERCENT_DENOMINATOR : talents.forgeBurnDamagePercent,
    talents.homesteadForgeBurnPercent ?? 0,
  );
  const bleed = talents.forgeToBleed ? PERCENT_DENOMINATOR : talents.forgeBleedDamagePercent;
  const shared = (gear?.sharedBurnBleedBonuses ?? 0) > 0;
  switch (damageType) {
    case "physical":
    case "stun":
      return PERCENT_DENOMINATOR;
    case "holy":
      return talents.forgeToHoly || (gear?.holyPreservesForge ?? 0) > 0 || (gear?.goldGrantsForgeAndHoly ?? 0) > 0
        ? PERCENT_DENOMINATOR
        : talents.forgeHolyDamagePercent;
    case "burn":
      return shared ? Math.max(burn, bleed) : burn;
    case "bleed":
      return shared ? Math.max(burn, bleed) : bleed;
    case "poison":
    case "freeze":
    case "nature":
      return 0;
  }
}

export function forgeAppliesToDamageType(
  damageType: DamageType,
  talentEffects: TalentEffectManifest,
  gearEffects?: BattleState["gearEffects"],
  companionAttack = false,
): boolean {
  return forgeDamagePercent(damageType, talentEffects, gearEffects, companionAttack) > 0;
}

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

function blockScaledDamage(state: BattleState, percent: number): number {
  return scalePercent(state.playerStatuses.block, percent, PERCENT_DENOMINATOR);
}

function getForgeBonusForDamage(state: BattleState, damageType: DamageType, companionAttack = false): number {
  if (!forgeAppliesToDamageType(damageType, state.talentEffects, state.gearEffects, companionAttack)) return 0;
  const forge = state.playerStatuses.forge;
  if (damageType === "physical" && state.talentEffects.forgeToPhysicalDamageMultiplier > 0) {
    return forge * state.talentEffects.forgeToPhysicalDamageMultiplier;
  }
  return scalePercent(forge, forgeDamagePercent(damageType, state.talentEffects, state.gearEffects, companionAttack));
}

function computeBaseRawAmount(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
  companionAttack = false,
): number {
  const forgeBonus = getForgeBonusForDamage(state, effect.damageType, companionAttack);

  // Forge replaces the base; the other resource attacks can also use Forge.
  let amount: number;
  if (effect.equalToForge) {
    amount = state.playerStatuses.forge;
  } else if (effect.equalToBlock) {
    amount = scalePercent(state.playerStatuses.block, effect.equalToBlockPercent ?? PERCENT_DENOMINATOR) + forgeBonus;
  } else if (effect.equalToArmor) {
    amount = state.playerStatuses.armor + forgeBonus;
  } else if (effect.equalToGoldPercent) {
    amount = scalePercent(state.gold, effect.equalToGoldPercent, PERCENT_DENOMINATOR) + forgeBonus;
  } else {
    amount = effect.amount + forgeBonus;
  }
  if (state.enemyCC.freezeSkipTurns > 0) amount += state.talentEffects.freezeDamageBonusVsFrozen;
  if (state.enemyStatuses.poison > 0) amount += state.talentEffects.poisonDamageBonusVsPoisoned;
  if (card?.tags?.includes("archery")) {
    amount += state.talentEffects.flatArrowDamage + state.gearEffects.flatArrowDamage;
    if (readCombatFlag(state, "archerySecondCardActive")) {
      amount += state.talentEffects.archerySecondCardDamage;
    }
    if (state.playerStatuses.block === 0) amount += state.talentEffects.archeryDamageWithoutBlock;
  }
  return amount;
}

function applyPhysicalScaling(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "physical");
  if (state.talentEffects.armorToPhysicalDamage) {
    nextAmount += state.playerStatuses.armor;
  } else {
    nextAmount += scalePercent(state.playerStatuses.armor, state.talentEffects.armorPhysicalDamagePercent);
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
  return state.playerHealth * HALF_DIVISOR < state.playerMaxHealth;
}

function applyPhysicalDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = applyPhysicalScaling(state, rawAmount);
  if (state.enemyStatuses.poison > 0) nextAmount += state.talentEffects.poisonPhysicalBonus;
  if (state.enemyStatuses.bleed > 0) nextAmount += state.talentEffects.bleedPhysicalBonus;
  return nextAmount;
}

function applyHolyDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "holy");
  nextAmount += scalePercent(state.gold, state.talentEffects.holyGoldPercent, PERCENT_DENOMINATOR);
  nextAmount += scalePercent(
    state.playerStatuses.block,
    state.gearEffects.holyDamageFromBlockPercent,
    PERCENT_DENOMINATOR,
  );
  nextAmount += scalePercent(state.gold, state.gearEffects.holyDamageFromGoldPercent, PERCENT_DENOMINATOR);
  if (state.talentEffects.blockToHolyDamage) {
    nextAmount += blockScaledDamage(state, BLOCK_SCALED_DAMAGE_PERCENT);
  } else {
    nextAmount += blockScaledDamage(state, state.talentEffects.blockHolyDamagePercent);
  }
  return nextAmount;
}

function applyBleedDamageModifiers(state: BattleState, rawAmount: number): number {
  return rawAmount + flatDamageBonus(state, "bleed");
}

function applyStunDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "stun");
  if (state.talentEffects.blockToStunDamage) {
    nextAmount += blockScaledDamage(state, BLOCK_SCALED_DAMAGE_PERCENT);
  } else {
    nextAmount += blockScaledDamage(state, state.talentEffects.blockStunDamagePercent);
  }
  return nextAmount;
}

function applyBurnDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "burn");
  if (state.talentEffects.burnDamagePerMana > 0) {
    nextAmount += scalePerMana(state.mana, state.talentEffects.burnDamagePerMana, "percent");
  } else if (state.talentEffects.burnDamagePerManaCrystal > 0) {
    nextAmount += scalePerMana(state.maxMana, state.talentEffects.burnDamagePerManaCrystal, "percent");
  }
  if (state.talentEffects.blockToBurnDamage) {
    nextAmount += blockScaledDamage(state, BURN_BLOCK_SCALED_DAMAGE_PERCENT);
  }
  return nextAmount;
}

function applyFreezeDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "freeze");
  if (state.talentEffects.freezeDamagePerMana > 0) {
    nextAmount += scalePerMana(state.mana, state.talentEffects.freezeDamagePerMana, "percent");
  } else if (state.talentEffects.freezeDamagePerManaCrystal > 0) {
    nextAmount += scalePerMana(state.maxMana, state.talentEffects.freezeDamagePerManaCrystal, "half");
  }
  return nextAmount;
}

function applyNatureDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "nature");
  if (state.talentEffects.armorToNatureDamage) {
    nextAmount += state.playerStatuses.armor;
  } else {
    nextAmount += scalePercent(state.playerStatuses.armor, state.talentEffects.armorNatureDamagePercent);
  }
  if (state.enemyStatuses.poison > 0) {
    nextAmount += state.talentEffects.natureBonusVsPoisoned;
  }
  return nextAmount;
}

function applyPoisonDamageModifiers(state: BattleState, rawAmount: number): number {
  return Math.round(
    (rawAmount + flatDamageBonus(state, "poison") + getPoisonBonusAgainstBleeding(state)) *
      getPoisonDamageMultiplierAgainstBleeding(state),
  );
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

export function computeBaseDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
  bonus = 0,
  companionAttack = false,
) {
  // These bonuses enlarge the original packet; they do not create follow-up hits.
  const poisonPotionBonus =
    card && !companionAttack && isPotionCard(card) && effect.damageType === "poison"
      ? state.talentEffects.poisonDamageOnConsume
      : 0;
  const consumeBurnBonus =
    card?.consume && !companionAttack && effect.damageType === "burn" ? state.gearEffects.burnOnConsume : 0;
  const potionBonus =
    card && !companionAttack && isPotionCard(card) ? (state.talentEffects.homesteadPotionBonus ?? 0) : 0;
  const rawAmount =
    computeBaseRawAmount(state, effect, card, companionAttack) +
    bonus +
    poisonPotionBonus +
    consumeBurnBonus +
    potionBonus;
  const hasBlock = effect.equalToBlock === true;
  const hasArmor = effect.equalToArmor === true;
  const hasGold = effect.equalToGoldPercent !== undefined;
  const isEqualTo = hasBlock || hasArmor || hasGold || effect.equalToForge === true;
  if (isEqualTo) return Math.max(0, rawAmount);
  const modifier = DAMAGE_TYPE_HANDLERS[effect.damageType];
  if (!modifier) throw new Error(`Missing DamageType handler: ${effect.damageType}`);
  let amount = modifier(state, rawAmount);
  if (state.gearEffects.sharedBurnBleedBonuses > 0) {
    if (effect.damageType === "burn") amount += applyBleedDamageModifiers(state, 0);
    if (effect.damageType === "bleed") amount += applyBurnDamageModifiers(state, 0);
  }
  return Math.max(0, amount);
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
  card: BattleCard | undefined,
  firstBonus: number,
  companionAttack = false,
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
