import { cardHasKeyword } from "./card-classification";
import { flatDamageBonus } from "./damage-modifiers";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import {
  getBurnBonusToBleedingMultiplier,
  getEnemyDamageMultiplier,
  getEnemyTraitDamageMultiplier,
  getPoisonBonusAgainstBleeding,
} from "./status-helpers";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { gearFrozenDamageMultiplier } from "./gear-effects";
import { scalePercent, scalePerMana } from "./amount-helpers";
import { type BattleCard, type BattleCardEffect, type DamageType, type TalentEffectManifest } from "@/lib/game-data";
import { reduceEnemyArmor, setFlag, type BattleState } from "./types";
import { paceCombatDamage } from "./fight-pacing";
import {
  ARCHERY_HIGH_HEALTH_THRESHOLD_PERCENT,
  ARCHERY_LOW_HEALTH_THRESHOLD_PERCENT,
  BLOCK_SCALED_DAMAGE_PERCENT,
  BURN_BLOCK_SCALED_DAMAGE_PERCENT,
  CRIT_MULTIPLIER,
  GLOBAL_CRIT_CHANCE,
  HALF_DIVISOR,
  MIN_DAMAGE_MULTIPLIER,
  PERCENT_DENOMINATOR,
} from "../game-constants";

export function forgeAppliesToDamageType(
  damageType: DamageType,
  talentEffects: TalentEffectManifest,
  gearEffects?: BattleState["gearEffects"],
  companionAttack = false,
): boolean {
  if (companionAttack && (gearEffects?.companionBenefitsFromForge ?? 0) > 0) return true;

  const shared = (gearEffects?.sharedBurnBleedBonuses ?? 0) > 0;
  switch (damageType) {
    case "physical":
    case "stun":
      return true;
    case "holy":
      return (
        talentEffects.forgeToHoly ||
        (gearEffects?.holyPreservesForge ?? 0) > 0 ||
        (gearEffects?.goldGrantsForgeAndHoly ?? 0) > 0
      );
    case "burn":
      return talentEffects.forgeToBurn || (shared && talentEffects.forgeToBleed);
    case "bleed":
      return talentEffects.forgeToBleed || (shared && talentEffects.forgeToBurn);
    case "poison":
    case "freeze":
    case "nature":
      return false;
  }
}

export function emptyBattleCard(id: string): BattleCard {
  return { id, title: "", descriptionLines: [], art: "", cost: 0, effects: [] };
}

export const REFLECTED_HOLY_CARD: BattleCard = emptyBattleCard("sun-struck-shield");

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
  return forge;
}

function computeBaseRawAmount(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
  companionAttack = false,
): number {
  const forgeBonus = getForgeBonusForDamage(state, effect.damageType, companionAttack);

  // Forge is already the entire base, including when a talent grants Forge to Burn.
  if (effect.equalToForge) return state.playerStatuses.forge;

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
  if (card?.tags?.includes("archery")) {
    amount += state.talentEffects.flatArrowDamage + state.gearEffects.flatArrowDamage;
  }
  return amount;
}

function applyPhysicalScaling(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "physical");
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
  }
  return nextAmount;
}

function applyBurnDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "burn");
  if (state.talentEffects.burnDamagePerManaCrystal > 0) {
    nextAmount += scalePerMana(state.maxMana, state.talentEffects.burnDamagePerManaCrystal, "percent");
  }
  if (state.talentEffects.blockToBurnDamage) {
    nextAmount += blockScaledDamage(state, BURN_BLOCK_SCALED_DAMAGE_PERCENT);
  }
  return nextAmount;
}

function applyFreezeDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "freeze");
  if (state.talentEffects.freezeDamagePerManaCrystal > 0) {
    nextAmount += scalePerMana(state.maxMana, state.talentEffects.freezeDamagePerManaCrystal, "half");
  }
  return nextAmount;
}

function applyNatureDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + flatDamageBonus(state, "nature");
  if (state.talentEffects.armorToNatureDamage) {
    nextAmount += state.playerStatuses.armor;
  }
  if (state.enemyStatuses.poison > 0) {
    nextAmount += state.talentEffects.natureBonusVsPoisoned;
  }
  return nextAmount;
}

function applyPoisonDamageModifiers(state: BattleState, rawAmount: number): number {
  return rawAmount + flatDamageBonus(state, "poison") + getPoisonBonusAgainstBleeding(state);
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
  bonus = 0,
  companionAttack = false,
) {
  const rawAmount = computeBaseRawAmount(state, effect, card, companionAttack) + bonus;
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
    if (isBelowHalfHealth(state) && state.talentEffects.physicalDoubledBelowHalfHealth) bonus += 1;
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
      state.enemyHealth * PERCENT_DENOMINATOR >= state.enemyMaxHealth * ARCHERY_HIGH_HEALTH_THRESHOLD_PERCENT
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

function applyCrit(damage: number, state: BattleState) {
  if (state.flags.nextHitCrit) return damage * CRIT_MULTIPLIER;
  return rollPercent(GLOBAL_CRIT_CHANCE, getBattleRng(state)) ? damage * CRIT_MULTIPLIER : damage;
}

function applyFirstDamageBonus(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
): { state: BattleState; firstBonus: number } {
  let nextState: BattleState = state;
  let firstBonus = 0;

  if (isBurnLikeDamage(effect.damageType, state)) {
    if (nextState.talentEffects.firstBurnCardBonusMultiplier > 1 && !nextState.flags.firstBurnCardDoubledUsed) {
      firstBonus += nextState.talentEffects.firstBurnCardBonusMultiplier - 1;
      nextState = setFlag(nextState, "firstBurnCardDoubledUsed", true);
    }
    if (nextState.trinketEffects.firstBurnDoubled && !nextState.flags.firstBurnTrinketDoubledUsed) {
      firstBonus += 1;
      nextState = setFlag(nextState, "firstBurnTrinketDoubledUsed", true);
    }
  }

  return { state: nextState, firstBonus };
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

export function computeTalentDamageToEnemy(
  state: BattleState,
  damageType: DamageType,
  amount: number,
  derived: boolean,
) {
  const base = derived ? Math.round(amount) : paceCombatDamage(state, amount, "player");
  const multiplier = derived
    ? getEnemyTraitDamageMultiplier(state, damageType)
    : getEnemyDamageMultiplier(state, damageType);
  const damage = Math.max(0, Math.round(base * multiplier));
  const afterBlock = applyBlockAbsorption(state, damage);
  const armor = damageType === "physical" || damageType === "stun" ? state.enemyMitigation.armor : 0;
  return { state: afterBlock.state, remainingDamage: Math.max(0, afterBlock.remainingDamage - armor) };
}

export function computeReflectedHolyDamageToEnemy(state: BattleState, blockLost: number) {
  const damage = Math.round(
    (blockLost * state.talentEffects.holyReflectionBlockLostPercent * getEnemyTraitDamageMultiplier(state, "holy")) /
      PERCENT_DENOMINATOR,
  );
  return applyBlockAbsorption(state, damage);
}

function computeBurnMultiplier(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleState): number {
  if (!isBurnLikeDamage(effect.damageType, state)) return 1;
  return getBurnBonusToBleedingMultiplier(state);
}

function resolveEncounterFirstHit(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  playedCard: boolean,
): { state: BattleState; multiplier: number } {
  const firstAttack =
    effect.damageType === "physical"
      ? { id: "heavy-hand" as const, flag: "encounterPhysicalUsed" as const }
      : effect.damageType === "holy"
        ? { id: "consecrated" as const, flag: "encounterHolyUsed" as const }
        : effect.damageType === "nature"
          ? { id: "wildheart" as const, flag: "encounterNatureUsed" as const }
          : null;
  if (playedCard && firstAttack && hasEncounterBenefit(state, firstAttack.id) && !state.flags[firstAttack.flag]) {
    return { state: setFlag(state, firstAttack.flag, true), multiplier: LABYRINTH_MODIFIER_CONFIG.double };
  }
  return { state, multiplier: 1 };
}

function resolveDamageBonusMultiplier(
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

function resolveDamageAfterMitigation(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card: BattleCard | undefined,
  finalDamage: number,
): { nextState: BattleState; modifiedDamage: number } {
  const { state: stateAfterBlock, remainingDamage: damageAfterBlock } = applyBlockAbsorption(state, finalDamage);
  const stateWithCritCleared = stateAfterBlock.flags.nextHitCrit
    ? setFlag(stateAfterBlock, "nextHitCrit", false)
    : stateAfterBlock;
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";
  const serpent =
    state.gearEffects.poisonedAttacksPierce > 0 && state.enemyStatuses.poison > 0 && !!card?.effects.length;
  const kingbreaker = effect.damageType === "stun" && state.gearEffects.armorIncreasesStun > 0;
  const nextState =
    serpent || kingbreaker
      ? stateWithCritCleared
      : applySunderingArmorPiercing(stateWithCritCleared, isPhysicalOrStun, card);
  const effectiveArmor =
    isPhysicalOrStun && !serpent && !kingbreaker && !effect.ignoreArmor ? nextState.enemyMitigation.armor : 0;
  return { nextState, modifiedDamage: Math.max(0, damageAfterBlock - effectiveArmor) };
}

export function computeCardDamageToEnemy(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
  context?: CardEffectResolutionContext,
) {
  const encounter = resolveEncounterFirstHit(state, effect, Boolean(context?.playedCard));
  state = encounter.state;
  const baseDamage = computeBaseDamage(state, effect, card, context?.baseDamageBonus, context?.companionAttack);
  const { state: stateAfterFirst, firstBonus } = applyFirstDamageBonus(state, effect);
  const totalMultiplier = resolveDamageBonusMultiplier(
    stateAfterFirst,
    effect,
    card,
    firstBonus,
    context?.companionAttack,
  );
  const scaledDamage = Math.round(baseDamage * totalMultiplier * encounter.multiplier);
  const pacedDamage = paceCombatDamage(stateAfterFirst, scaledDamage, "player");
  const repeatedDamage = Math.round(pacedDamage * (context?.damageMultiplier ?? 1));
  const criticalDamage = context?.guaranteedCrit
    ? repeatedDamage * CRIT_MULTIPLIER
    : applyCrit(repeatedDamage, stateAfterFirst);
  const kingbreaker = effect.damageType === "stun" && state.gearEffects.armorIncreasesStun > 0;
  const finalDamage = criticalDamage + (kingbreaker ? state.enemyMitigation.armor : 0);

  return resolveDamageAfterMitigation(stateAfterFirst, effect, card, finalDamage);
}
