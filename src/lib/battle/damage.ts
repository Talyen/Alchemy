/**
 * Handles player damage calculations, critical strikes, armor mitigation, and status riders.
 * Depends on: ./status-effects, ./combat-text, ./trinket-effects, ./wish, ./types, ../game-constants.
 * Depended on by: ./apply-effects.
 */
import { applyDamageStatuses, getEnemyDamageMultiplier, resolveStunTrigger } from "./status-effects";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { applyBoneCharmHeal, applyLuckyCloverGold } from "./trinket-effects";
import { applyWishEffect } from "./wish";
import { rollPercent } from "./status-helpers";
import { type BattleCard, type BattleCardEffect, type PlayerStatusId } from "@/lib/game-data";
import {
  addEnemyStatus,
  addGold,
  addPlayerStatus,
  applyPlayerHealing,
  clampHealth,
  isNullFieldActive,
  setFlag,
  type BattleState,
  type CombatTextEvent,
  type EnemyMitigation,
} from "./types";
import {
  BATTLE_CONFIG,
  BLEED_EXECUTE_MULTIPLIER,
  CRIT_MULTIPLIER,
  FIRST_EFFECT_MULTIPLIER,
  GLOBAL_CRIT_CHANCE,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
  STATUS_CONFIG,
} from "../game-constants";
const DAMAGE_CONSTANTS = {
  DOUBLE_MULTIPLIER: 2,
  WISH_COUNT_SINGLE: 1,
};

function getPlayerBlockHalf(state: BattleState): number {
  return Math.round(state.playerStatuses.block / HALF_DIVISOR);
}

/**
 * Calculates raw base damage amount before any keyword specific modifiers are applied.
 * Evaluates forge bonus and whether the damage scales on current block or armor.
 */
function computeBaseRawAmount(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>): number {
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";
  const isBurn = effect.damageType === "burn";
  const isHoly = effect.damageType === "holy";
  const isBleed = effect.damageType === "bleed";

  let forgeBonus = 0;
  if (isPhysicalOrStun) forgeBonus = state.playerStatuses.forge;
  if (isBurn && state.talentEffects.forgeToBurn) forgeBonus = state.playerStatuses.forge;
  if (isHoly && state.talentEffects.forgeToHoly) forgeBonus = state.playerStatuses.forge;
  if (isBleed && state.talentEffects.forgeToBleed) forgeBonus = state.playerStatuses.forge;

  if (effect.equalToBlock) {
    return state.playerStatuses.block + forgeBonus;
  }
  if (effect.equalToArmor) {
    return state.playerStatuses.armor + forgeBonus;
  }
  return effect.amount + forgeBonus;
}

/**
 * Applies physical damage modifiers from character talent effects.
 * Takes into account flat bonus, armor/block scaling, stunned/frozen multipliers, and bleed/poison status bonuses.
 */
function applyPhysicalScaling(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatPhysicalDamage;
  if (state.talentEffects.armorToPhysicalDamage) {
    nextAmount += state.playerStatuses.armor;
  }
  if (state.talentEffects.blockToPhysicalDamageMultiplier > 0) {
    nextAmount += Math.round(state.playerStatuses.block * state.talentEffects.blockToPhysicalDamageMultiplier);
  } else if (state.talentEffects.blockToPhysicalDamage) {
    nextAmount += getPlayerBlockHalf(state);
  }
  if (state.talentEffects.forgeToPhysicalDamageMultiplier > 0) {
    nextAmount += state.playerStatuses.forge;
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
  let nextAmount = rawAmount;
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
  let nextAmount = rawAmount;
  if (state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR && state.talentEffects.bleedDesperateMultiplier > 1) {
    nextAmount = Math.round(nextAmount * state.talentEffects.bleedDesperateMultiplier);
  }
  if (state.enemyHealth <= (state.enemyMaxHealth * state.talentEffects.bleedExecuteThreshold) / PERCENT_DENOMINATOR) {
    nextAmount = Math.round(nextAmount * BLEED_EXECUTE_MULTIPLIER);
  }
  return nextAmount;
}

function applyStunDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatStunDamage;
  if (state.talentEffects.blockToStunDamage) {
    nextAmount += getPlayerBlockHalf(state);
  }
  return nextAmount;
}

function applyArrowDamageModifiers(state: BattleState, rawAmount: number): number {
  return rawAmount + state.talentEffects.flatArrowDamage;
}

function applyBurnDamageModifiers(state: BattleState, rawAmount: number, card?: BattleCard): number {
  let nextAmount = rawAmount + state.talentEffects.flatBurnDamage;
  nextAmount += Math.round((state.maxMana * state.talentEffects.burnDamagePerManaCrystal) / HALF_DIVISOR);
  if (state.talentEffects.blockToBurnDamage) {
    nextAmount += getPlayerBlockHalf(state);
  }
  if (card?.consume && state.talentEffects.consumeDoubleBurnDamage) {
    nextAmount *= DAMAGE_CONSTANTS.DOUBLE_MULTIPLIER;
  }
  return nextAmount;
}

function applyFreezeDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatFreezeDamage;
  nextAmount += Math.round((state.maxMana * state.talentEffects.freezeDamagePerManaCrystal) / HALF_DIVISOR);
  return nextAmount;
}

function applyNatureDamageModifiers(state: BattleState, rawAmount: number): number {
  return rawAmount + state.talentEffects.flatNatureDamage;
}

function applyPoisonDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount;
  if (state.enemyStatuses.bleed > 0) {
    nextAmount += state.talentEffects.bleedPoisonDamageTakenBonus;
  }
  return nextAmount;
}

/**
 * Computes core damage before crit, armor, and traits.
 */
function computeBaseDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
) {
  const rawAmount = computeBaseRawAmount(state, effect);
  let nextAmount = rawAmount;

  switch (effect.damageType) {
    case "physical":
      nextAmount = applyPhysicalDamageModifiers(state, rawAmount);
      break;
    case "holy":
      nextAmount = applyHolyDamageModifiers(state, rawAmount);
      break;
    case "bleed":
      nextAmount = applyBleedDamageModifiers(state, rawAmount);
      break;
    case "stun":
      nextAmount = applyStunDamageModifiers(state, rawAmount);
      break;
    case "arrow":
      nextAmount = applyArrowDamageModifiers(state, rawAmount);
      break;
    case "burn":
      nextAmount = applyBurnDamageModifiers(state, rawAmount, card);
      break;
    case "freeze":
      nextAmount = applyFreezeDamageModifiers(state, rawAmount);
      break;
    case "nature":
      nextAmount = applyNatureDamageModifiers(state, rawAmount);
      break;
    case "poison":
      nextAmount = applyPoisonDamageModifiers(state, rawAmount);
      break;
    default:
      break;
  }

  return Math.max(0, nextAmount);
}

/**
 * Evaluates whether damage turns into a critical strike and returns modified damage.
 */
function applyCrit(damage: number, damageType: string, state: BattleState) {
  const physCritChance = damageType === "physical" ? state.talentEffects.physicalCritChance : 0;
  const totalChance = GLOBAL_CRIT_CHANCE + physCritChance;
  const isCrit = totalChance > 0 && state.rng() * PERCENT_DENOMINATOR < totalChance;
  return isCrit ? damage * CRIT_MULTIPLIER : damage;
}

/**
 * Deduplicates player healing, combat text merging, and overheal-to-block triggers.
 */
function executePlayerHealing(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const healAmount = Math.round(amount * state.talentEffects.healMultiplier);
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  const nextState = applyPlayerHealing(state, healAmount);
  emitOverhealBlockText(state, nextState, combatTexts);
  return nextState;
}

function applyLeechBleedRider(state: BattleState, damage: number): BattleState {
  if (state.talentEffects.leechBleedChance > 0 && rollPercent(state.talentEffects.leechBleedChance, state.rng)) {
    return addEnemyStatus(state, "bleed", damage);
  }
  return state;
}

function applyLeechManaRider(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.talentEffects.manaOnLeechChance > 0 && rollPercent(state.talentEffects.manaOnLeechChance, state.rng)) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: 1 });
    return { ...state, mana: state.mana + 1 };
  }
  return state;
}

function applyLeechBoonSiphonRider(state: BattleState): BattleState {
  if (state.talentEffects.boonSiphonChance > 0 && rollPercent(state.talentEffects.boonSiphonChance, state.rng)) {
    const mit = state.enemyMitigation;
    const pool: { key: keyof EnemyMitigation; status: PlayerStatusId }[] = [];
    if (mit.forge > 0) pool.push({ key: "forge", status: "forge" });
    if (mit.armor > 0) pool.push({ key: "armor", status: "armor" });
    if (mit.block > 0) pool.push({ key: "block", status: "block" });
    if (pool.length > 0) {
      const steal = pool[Math.trunc(state.rng() * pool.length)];
      const nextState = {
        ...state,
        enemyMitigation: { ...mit, [steal.key]: Math.max(0, mit[steal.key] - 1) },
      };
      return addPlayerStatus(nextState, steal.status, 1);
    }
  }
  return state;
}

function applyLeechPoisonRider(state: BattleState, damage: number): BattleState {
  if (state.talentEffects.leechPoisonChance > 0 && rollPercent(state.talentEffects.leechPoisonChance, state.rng)) {
    return addEnemyStatus(state, "poison", damage);
  }
  return state;
}

/**
 * Applies standard lifesteal to restore player health based on damage dealt.
 */
function applyLeechHitRiders(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  let nextState = state;
  nextState = applyLeechBleedRider(nextState, damage);
  nextState = applyLeechManaRider(nextState, combatTexts);
  nextState = applyLeechBoonSiphonRider(nextState);
  nextState = applyLeechPoisonRider(nextState, damage);
  return nextState;
}

function applyLifestealAndPlayerHitTriggers(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0) return state;

  let healAmount = damage;

  if (state.talentEffects.firstLeechCardDoubled && !state.flags.firstLeechCardDoubledUsed) {
    healAmount *= FIRST_EFFECT_MULTIPLIER;
    state = setFlag(state, "firstLeechCardDoubledUsed", true);
  }

  if (state.talentEffects.leechDesperateMultiplier > 0 && state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR) {
    healAmount = Math.round(healAmount * (1 + state.talentEffects.leechDesperateMultiplier / PERCENT_DENOMINATOR));
  }

  if (state.talentEffects.leechExecuteMultiplier > 0 && state.enemyHealth <= state.enemyMaxHealth / HALF_DIVISOR) {
    healAmount = Math.round(healAmount * (1 + state.talentEffects.leechExecuteMultiplier / PERCENT_DENOMINATOR));
  }

  if (state.talentEffects.leechMissingHealthStep > 0) {
    const missing = state.playerMaxHealth - state.playerHealth;
    healAmount += Math.round(missing / state.talentEffects.leechMissingHealthStep);
  }

  const nextState = executePlayerHealing(state, healAmount, combatTexts);
  return applyLeechHitRiders(nextState, damage, combatTexts);
}

/**
 * Restores player health proportionally for holy damage types.
 */
function applyNatureLeech(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || !rollPercent(state.talentEffects.natureLeechChance, state.rng)) return state;
  return applyLifestealAndPlayerHitTriggers(state, damage, combatTexts);
}

function applyHolyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyLifestealPercent <= 0) return state;
  const healAmount = Math.round((damage * state.talentEffects.holyLifestealPercent) / PERCENT_DENOMINATOR);
  if (healAmount <= 0) return state;
  return executePlayerHealing(state, healAmount, combatTexts);
}

/**
 * Grants player block proportionally when holy damage is dealt.
 */
function applyDamageBlock(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyBlockPercentFromDamage <= 0) return state;
  const blockAmount = Math.round((damage * state.talentEffects.holyBlockPercentFromDamage) / PERCENT_DENOMINATOR);
  if (blockAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: blockAmount });
  return addPlayerStatus(state, "block", blockAmount);
}

/**
 * Grants gold proportional to holy damage with a percentage chance when Tithe is active.
 */
function applyHolyTithe(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyGoldChance <= 0) return state;
  if (state.rng() * PERCENT_DENOMINATOR < state.talentEffects.holyGoldChance) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: damage });
    return addGold(state, damage);
  }
  return state;
}

/**
 * Processes first-time burn multipliers from talents and trinkets.
 */
function applyFirstBurnModifiers(
  state: BattleState,
  rawDamage: number,
): { damage: number; flagsToSet: Partial<BattleState["flags"]> } {
  let nextDamage = rawDamage;
  const flagsToSet: Partial<BattleState["flags"]> = {};

  if (state.talentEffects.firstBurnCardDoubled && !state.flags.firstBurnCardDoubledUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    flagsToSet.firstBurnCardDoubledUsed = true;
  }
  if (state.trinketEffects.firstBurnDoubled && !state.flags.firstBurnTrinketDoubledUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    flagsToSet.firstBurnTrinketDoubledUsed = true;
  }

  return { damage: nextDamage, flagsToSet };
}

/**
 * Processes first-time holy modifiers from trinkets.
 */
function applyFirstHolyModifiers(
  state: BattleState,
  rawDamage: number,
): { damage: number; flagsToSet: Partial<BattleState["flags"]> } {
  let nextDamage = rawDamage;
  const flagsToSet: Partial<BattleState["flags"]> = {};

  if (state.trinketEffects.firstHolyDamageDoubled && !state.flags.firstHolyDamageBonusUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    flagsToSet.firstHolyDamageBonusUsed = true;
  }

  return { damage: nextDamage, flagsToSet };
}

/**
 * Wraps first-card doubling modifications for damage types.
 */
function applyFirstDamageModifiers(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  rawDamage: number,
): { rawDamage: number; flagsToSet: Partial<BattleState["flags"]> } {
  if (effect.damageType === "burn") {
    const res = applyFirstBurnModifiers(state, rawDamage);
    return { rawDamage: res.damage, flagsToSet: res.flagsToSet };
  }
  if (effect.damageType === "holy") {
    const res = applyFirstHolyModifiers(state, rawDamage);
    return { rawDamage: res.damage, flagsToSet: res.flagsToSet };
  }
  return { rawDamage, flagsToSet: {} };
}

/**
 * Resolves trinket-based stun triggers from playing high physical/stun damage with active forge stacks.
 */
function applyForgeStunRider(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  if (
    effect.damageType !== "physical" ||
    state.trinketEffects.forgeStunThreshold <= 0 ||
    state.playerStatuses.forge < state.trinketEffects.forgeStunThreshold
  )
    return state;

  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "status",
    stat: "stun",
    amount: state.trinketEffects.forgeStunAmount,
  });

  return resolveStunTrigger(addEnemyStatus(state, "stun", state.trinketEffects.forgeStunAmount), combatTexts);
}

/**
 * Applies riders specific to holy damage: lifesteal, block gain, burn chance, and wish chance.
 */
function applyHolyDamageRiders(state: BattleState, card: BattleCard, damage: number, combatTexts: CombatTextEvent[]) {
  let nextState = applyHolyLifesteal(state, damage, combatTexts);
  nextState = applyDamageBlock(nextState, damage, combatTexts);
  nextState = applyHolyTithe(nextState, damage, combatTexts);

  if (
    nextState.talentEffects.holyBurnChance > 0 &&
    nextState.rng() * PERCENT_DENOMINATOR < nextState.talentEffects.holyBurnChance
  ) {
    const burnAmount = isNullFieldActive(nextState)
      ? Math.max(STATUS_CONFIG.MIN_STACK_AMOUNT, Math.round(damage / HALF_DIVISOR))
      : damage;
    nextState = addEnemyStatus(nextState, "burn", burnAmount);
  }

  if (
    nextState.talentEffects.holyWishChance > 0 &&
    nextState.rng() * PERCENT_DENOMINATOR < nextState.talentEffects.holyWishChance
  ) {
    nextState = applyWishEffect(nextState, card, DAMAGE_CONSTANTS.WISH_COUNT_SINGLE, combatTexts);
  }

  return nextState;
}

/**
 * Consumes player forge charge after executing a damage hit.
 * Forge is consumed whenever it contributed to the damage — whether
 * through physical/stun natively or burn/holy via talent effects.
 */
function consumeForgeAfterDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  damage: number,
) {
  // Forge decays only when it actually contributed. Condition mirrors computeBaseRawAmount's
  // forge logic. No forge consumed if damage was 0 (miss or fully blocked).
  const forgeWasApplied =
    effect.damageType === "physical" ||
    effect.damageType === "stun" ||
    (effect.damageType === "burn" && state.talentEffects.forgeToBurn) ||
    (effect.damageType === "holy" && state.talentEffects.forgeToHoly) ||
    (effect.damageType === "bleed" && state.talentEffects.forgeToBleed);

  if (!forgeWasApplied || damage <= 0 || state.playerStatuses.forge <= 0) return state;

  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      forge: Math.max(0, state.playerStatuses.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT),
    },
  };
}

/**
 * Computes final adjusted damage to the enemy, considering critical strikes, traits, and armor reduction.
 */
function applySunderingArmorPiercing(state: BattleState, isPhysicalOrStun: boolean): BattleState {
  if (isPhysicalOrStun && state.trinketEffects.sunderingArmorPiercing > 0 && state.enemyMitigation.armor > 0) {
    const removed = Math.min(state.enemyMitigation.armor, state.trinketEffects.sunderingArmorPiercing);
    return {
      ...state,
      enemyMitigation: {
        ...state.enemyMitigation,
        armor: state.enemyMitigation.armor - removed,
      },
    };
  }
  return state;
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

/**
 * Computes final adjusted damage to the enemy, considering critical strikes, traits, and armor reduction.
 */
function computeCardDamageToEnemy(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  card?: BattleCard,
) {
  const { rawDamage, flagsToSet } = applyFirstDamageModifiers(state, effect, computeBaseDamage(state, effect, card));
  const finalDamage = applyCrit(rawDamage, effect.damageType, state);

  const { state: stateAfterBlock, remainingDamage: damageAfterBlock } = applyBlockAbsorption(state, finalDamage);
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";

  const nextState = applySunderingArmorPiercing(stateAfterBlock, isPhysicalOrStun);
  const effectiveArmor = isPhysicalOrStun ? nextState.enemyMitigation.armor : 0;
  const damageAfterArmor = Math.max(0, damageAfterBlock - effectiveArmor);
  const multiplier = getEnemyDamageMultiplier(state, effect.damageType);
  return { nextState, modifiedDamage: Math.round(damageAfterArmor * multiplier), flagsToSet };
}

/**
 * Decreases enemy armor by decay amount on health-hitting damage.
 * Block is fully consumed by damage absorption and does not decay separately.
 */
function decayEnemyDefensesOnHit(state: BattleState, modifiedDamage: number): BattleState {
  if (modifiedDamage <= 0) return state;
  if (state.enemyMitigation.armor <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT),
    },
  };
}

function applyBurnDamageRiders(state: BattleState, modifiedDamage: number): BattleState {
  let nextState = state;
  if (state.talentEffects.forgeOnBurnDealt > 0) {
    nextState = addPlayerStatus(nextState, "forge", state.talentEffects.forgeOnBurnDealt);
  }
  if (state.talentEffects.burnStunChance > 0 && rollPercent(state.talentEffects.burnStunChance, state.rng)) {
    nextState = addEnemyStatus(nextState, "stun", modifiedDamage);
  }
  return nextState;
}

function applyNatureDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = applyLuckyCloverGold(state, modifiedDamage, combatTexts);
  if (state.talentEffects.natureLeechChance > 0) {
    nextState = applyNatureLeech(nextState, modifiedDamage, combatTexts);
  }
  return nextState;
}

/**
 * Processes secondary damage riders (bone charm heal, damage statuses, lifesteal, clover gold).
 */
function applyDamageRiders(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
) {
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -modifiedDamage, state.enemyMaxHealth),
  };

  nextState = decayEnemyDefensesOnHit(nextState, modifiedDamage);
  // boneCharmHeal uses state.enemyHealth > 0 (pre-hit state), not nextState,
  // so heal-on-kill only triggers if the enemy WAS alive before this hit.
  nextState = applyBoneCharmHeal(nextState, state.enemyHealth > 0, combatTexts);
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts);
  nextState = applyForgeStunRider(nextState, effect, combatTexts);

  if (effect.damageType === "burn" && modifiedDamage > 0) {
    nextState = applyBurnDamageRiders(nextState, modifiedDamage);
  }

  if (effect.lifesteal) {
    nextState = applyLifestealAndPlayerHitTriggers(nextState, modifiedDamage, combatTexts);
  }
  if (effect.damageType === "holy") {
    nextState = applyHolyDamageRiders(nextState, card, modifiedDamage, combatTexts);
  }

  if (effect.damageType === "nature") {
    nextState = applyNatureDamageRiders(nextState, modifiedDamage, combatTexts);
  }

  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: modifiedDamage });
  }

  return consumeForgeAfterDamage(nextState, effect, modifiedDamage);
}

/**
 * Evaluates core damage calculation and triggers all associated status/health riders.
 */
export function dealDamageToEnemy(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  const { nextState, modifiedDamage, flagsToSet } = computeCardDamageToEnemy(state, effect, card);

  let stateWithFlags = nextState;
  if (Object.keys(flagsToSet).length > 0) {
    stateWithFlags = {
      ...nextState,
      flags: {
        ...nextState.flags,
        ...flagsToSet,
      },
    };
  }

  return applyDamageRiders(stateWithFlags, card, effect, modifiedDamage, combatTexts);
}
