/**
 * Handles player damage calculations, critical strikes, armor mitigation, and status riders.
 * Depends on: ./status-effects, ./combat-text, ./trinket-effects, ./wish, ./types, ../game-constants.
 * Depended on by: ./apply-effects.
 */
import { applyDamageStatuses, getEnemyDamageMultiplier, resolveStunTrigger } from "./status-effects";
import { mergeCombatText } from "./combat-text";
import { applyBoneCharmHeal, applyLuckyCloverGold } from "./trinket-effects";
import { applyWishEffect } from "./wish";
import { type BattleCard, type BattleCardEffect } from "@/lib/game-data";
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
} from "./types";
import {
  BATTLE_CONFIG,
  BLEED_EXECUTE_MULTIPLIER,
  CRIT_MULTIPLIER,
  FIRST_EFFECT_MULTIPLIER,
  GLOBAL_CRIT_CHANCE,
  GOLD_TROVE_DAMAGE_REWARD,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
} from "../game-constants";

const DAMAGE_CONFIG = {
  MIN_BURN_AMOUNT: 1,
  WISH_COUNT_SINGLE: 1,
};

/**
 * Calculates raw base damage amount before any keyword specific modifiers are applied.
 * Evaluates forge bonus and whether the damage scales on current block or armor.
 */
function computeBaseRawAmount(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>): number {
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";
  const isBurn = effect.damageType === "burn";
  const isHoly = effect.damageType === "holy";

  let forgeBonus = 0;
  if (isPhysicalOrStun) forgeBonus = state.playerStatuses.forge;
  if (isBurn && state.talentEffects.forgeToBurn) forgeBonus = state.playerStatuses.forge;
  if (isHoly && state.talentEffects.forgeToHoly) forgeBonus = state.playerStatuses.forge;

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
function applyPhysicalDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount + state.talentEffects.flatPhysicalDamage;
  if (state.talentEffects.armorToPhysicalDamage) {
    nextAmount += state.playerStatuses.armor;
  }
  if (state.talentEffects.blockToPhysicalDamage) {
    nextAmount += Math.round(state.playerStatuses.block / HALF_DIVISOR);
  }
  if (state.enemyStunSkipTurns > 0) {
    nextAmount = Math.round(nextAmount * (1 + state.talentEffects.physicalVsStunnedMultiplier / PERCENT_DENOMINATOR));
  }
  if (state.enemyFreezeSkipTurns > 0) {
    nextAmount = Math.round(nextAmount * (1 + state.talentEffects.physicalVsFrozenMultiplier / PERCENT_DENOMINATOR));
  }
  if (state.enemyStatuses.poison > 0) {
    nextAmount += state.talentEffects.poisonPhysicalBonus;
  }
  if (state.enemyStatuses.bleed > 0) {
    nextAmount += state.talentEffects.bleedPhysicalBonus + state.talentEffects.bleedPhysicalTakenBonus;
  }
  return nextAmount;
}

/**
 * Applies holy damage modifiers based on player gold and current block.
 * Amplifies output if the target is currently afflicted with burn.
 */
function applyHolyDamageModifiers(state: BattleState, rawAmount: number): number {
  let nextAmount = rawAmount;
  nextAmount += Math.round((state.gold * state.talentEffects.holyGoldPercent) / PERCENT_DENOMINATOR);
  nextAmount += Math.round((state.playerStatuses.block * state.talentEffects.holyBlockPercent) / PERCENT_DENOMINATOR);
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

/**
 * Computes core damage before crit, armor, and traits.
 */
function computeBaseDamage(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>) {
  let rawAmount = computeBaseRawAmount(state, effect);

  if (effect.damageType === "physical") {
    rawAmount = applyPhysicalDamageModifiers(state, rawAmount);
  } else if (effect.damageType === "holy") {
    rawAmount = applyHolyDamageModifiers(state, rawAmount);
  } else if (effect.damageType === "bleed") {
    rawAmount = applyBleedDamageModifiers(state, rawAmount);
  } else if (effect.damageType === "stun") {
    rawAmount += state.talentEffects.flatStunDamage;
  } else if (effect.damageType === "trap") {
    rawAmount += state.talentEffects.flatTrapDamage;
  }

  return Math.max(0, rawAmount);
}

/**
 * Evaluates whether damage turns into a critical strike and returns modified damage.
 */
function applyCrit(damage: number, damageType: string, state: BattleState) {
  const physCritChance = damageType === "physical" ? state.talentEffects.physicalCritChance : 0;
  const totalChance = GLOBAL_CRIT_CHANCE + physCritChance;
  const isCrit = totalChance > 0 && Math.random() * PERCENT_DENOMINATOR < totalChance;
  return isCrit ? damage * CRIT_MULTIPLIER : damage;
}

/**
 * Applies standard lifesteal to restore player health based on damage dealt.
 */
function applyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0) return state;
  const healAmount = Math.round(damage * state.talentEffects.healMultiplier);
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  return applyPlayerHealing(state, healAmount);
}

/**
 * Restores player health proportionally for holy damage types.
 */
function applyHolyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyLifestealPercent <= 0) return state;
  const healAmount = Math.round(
    ((damage * state.talentEffects.holyLifestealPercent) / PERCENT_DENOMINATOR) * state.talentEffects.healMultiplier,
  );
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  return applyPlayerHealing(state, healAmount);
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
 * Processes first-time burn multipliers from talents and trinkets.
 */
function applyFirstBurnModifiers(state: BattleState, rawDamage: number): { state: BattleState; damage: number } {
  let nextState = state;
  let nextDamage = rawDamage;

  if (nextState.talentEffects.firstBurnCardDoubled && !nextState.flags.firstBurnCardDoubledUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstBurnCardDoubledUsed", true);
  }
  if (nextState.trinketEffects.firstBurnDoubled && !nextState.flags.firstBurnTrinketDoubledUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstBurnTrinketDoubledUsed", true);
  }

  return { state: nextState, damage: nextDamage };
}

/**
 * Processes first-time holy modifiers from trinkets.
 */
function applyFirstHolyModifiers(state: BattleState, rawDamage: number): { state: BattleState; damage: number } {
  let nextState = state;
  let nextDamage = rawDamage;

  if (nextState.trinketEffects.firstHolyDamageDoubled && !nextState.flags.firstHolyDamageBonusUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstHolyDamageBonusUsed", true);
  }

  return { state: nextState, damage: nextDamage };
}

/**
 * Wraps first-card doubling modifications for damage types.
 */
function applyFirstDamageModifiers(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  rawDamage: number,
) {
  if (effect.damageType === "burn") {
    const res = applyFirstBurnModifiers(state, rawDamage);
    return { state: res.state, rawDamage: res.damage };
  }
  if (effect.damageType === "holy") {
    const res = applyFirstHolyModifiers(state, rawDamage);
    return { state: res.state, rawDamage: res.damage };
  }
  return { state, rawDamage };
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

  if (
    nextState.talentEffects.holyBurnChance > 0 &&
    Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.holyBurnChance
  ) {
    const burnAmount = isNullFieldActive(nextState)
      ? Math.max(DAMAGE_CONFIG.MIN_BURN_AMOUNT, Math.round(damage / HALF_DIVISOR))
      : damage;
    nextState = {
      ...nextState,
      enemyStatuses: { ...nextState.enemyStatuses, burn: nextState.enemyStatuses.burn + burnAmount },
    };
  }

  if (
    nextState.talentEffects.holyWishChance > 0 &&
    Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.holyWishChance
  ) {
    nextState = applyWishEffect(nextState, card, DAMAGE_CONFIG.WISH_COUNT_SINGLE, combatTexts);
  }

  return nextState;
}

/**
 * Awards player gold if the enemy has the "gold-trove" trait (e.g. Mimic).
 */
function applyGoldTroveReward(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (!state.currentEnemy.traits.some((t) => t.id === "gold-trove") || damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: GOLD_TROVE_DAMAGE_REWARD });
  return addGold(state, GOLD_TROVE_DAMAGE_REWARD);
}

/**
 * Consumes player forge charge after executing a physical/stun hit.
 */
function consumeForgeAfterPhysicalDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  damage: number,
) {
  if (
    (effect.damageType !== "physical" && effect.damageType !== "stun") ||
    damage <= 0 ||
    state.playerStatuses.forge <= 0
  )
    return state;
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      forge: state.playerStatuses.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT,
    },
  };
}

/**
 * Computes final adjusted damage to the enemy, considering critical strikes, traits, and armor reduction.
 */
function computeCardDamageToEnemy(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>) {
  const modifiedBase = applyFirstDamageModifiers(state, effect, computeBaseDamage(state, effect));
  const rawDamage = modifiedBase.rawDamage;
  const finalDamage = applyCrit(rawDamage, effect.damageType, modifiedBase.state);
  const effectiveArmor =
    effect.damageType === "physical" ? Math.max(0, state.enemyArmor - state.trinketEffects.sunderingArmorPiercing) : 0;
  const damageAfterArmor = Math.max(0, finalDamage - effectiveArmor);
  const multiplier = getEnemyDamageMultiplier(state, effect.damageType);
  return { nextState: modifiedBase.state, modifiedDamage: Math.round(damageAfterArmor * multiplier) };
}

/**
 * Decreases enemy armor stacks by decay configuration on health-hitting damage.
 */
function decayEnemyArmorOnHit(state: BattleState, modifiedDamage: number): BattleState {
  if (modifiedDamage > 0 && state.enemyArmor > 0) {
    return { ...state, enemyArmor: state.enemyArmor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT };
  }
  return state;
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

  nextState = decayEnemyArmorOnHit(nextState, modifiedDamage);
  nextState = applyBoneCharmHeal(nextState, state.enemyHealth > 0, combatTexts);
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts);
  nextState = applyForgeStunRider(nextState, effect, combatTexts);

  if (effect.lifesteal) nextState = applyLifesteal(nextState, modifiedDamage, combatTexts);
  if (effect.damageType === "holy") nextState = applyHolyDamageRiders(nextState, card, modifiedDamage, combatTexts);

  nextState = applyGoldTroveReward(nextState, modifiedDamage, combatTexts);
  if (effect.damageType === "nature") nextState = applyLuckyCloverGold(nextState, modifiedDamage, combatTexts);

  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: modifiedDamage });
  }

  return consumeForgeAfterPhysicalDamage(nextState, effect, modifiedDamage);
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
  const { nextState, modifiedDamage } = computeCardDamageToEnemy(state, effect);
  return applyDamageRiders(nextState, card, effect, modifiedDamage, combatTexts);
}
