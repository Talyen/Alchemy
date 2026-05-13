// Damage computation, crit, lifesteal, and enemy damage dealing with all riders.
import { applyDamageStatuses, getEnemyDamageMultiplier, resolveStunTrigger } from "./status-effects";
import { applyBoneCharmHeal } from "./trinket-utils";
import { mergeCombatText } from "./combat-text";
import { buildWishOptions } from "./wish";
import { type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import {
  applyPlayerHealing,
  clampHealth,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import {
  BLEED_EXECUTE_MULTIPLIER,
  CRIT_MULTIPLIER,
  FIRST_EFFECT_MULTIPLIER,
  GLOBAL_CRIT_CHANCE,
  GOLD_TROVE_DAMAGE_REWARD,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
} from "../game-constants";

function computeBaseDamage(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>) {
  const isPhysicalOrStun = effect.damageType === "physical" || effect.damageType === "stun";
  const isBurn = effect.damageType === "burn";
  const isHoly = effect.damageType === "holy";

  let forgeBonus = 0;
  if (isPhysicalOrStun) forgeBonus = state.playerStatuses.forge;
  if (isBurn && state.talentEffects.forgeToBurn) forgeBonus = state.playerStatuses.forge;
  if (isHoly && state.talentEffects.forgeToHoly) forgeBonus = state.playerStatuses.forge;

  let rawAmount = effect.fromBlock ? state.playerStatuses.block + forgeBonus : effect.amount + forgeBonus;

  if (effect.damageType === "physical") {
    rawAmount += state.talentEffects.flatPhysicalDamage;
    if (state.talentEffects.armorToPhysicalDamage) {
      rawAmount += state.playerStatuses.armor;
    }
    if (state.talentEffects.blockToPhysicalDamage) {
      rawAmount += Math.floor(state.playerStatuses.block / HALF_DIVISOR);
    }
    if (state.enemyStunSkipTurns > 0) {
      rawAmount = Math.floor(rawAmount * (1 + state.talentEffects.physicalVsStunnedMultiplier / PERCENT_DENOMINATOR));
    }
    if (state.enemyFreezeSkipTurns > 0) {
      rawAmount = Math.floor(rawAmount * (1 + state.talentEffects.physicalVsFrozenMultiplier / PERCENT_DENOMINATOR));
    }
    if (state.enemyStatuses.poison > 0) {
      rawAmount += state.talentEffects.poisonPhysicalBonus;
    }
    if (state.enemyStatuses.bleed > 0) {
      rawAmount += state.talentEffects.bleedPhysicalBonus + state.talentEffects.bleedPhysicalTakenBonus;
    }
  }

  if (effect.damageType === "holy") {
    rawAmount += Math.floor(state.gold * state.talentEffects.holyGoldPercent / PERCENT_DENOMINATOR);
    rawAmount += Math.floor(state.playerStatuses.block * state.talentEffects.holyBlockPercent / PERCENT_DENOMINATOR);
    if (state.enemyStatuses.burn > 0) {
      rawAmount = Math.floor(rawAmount * (1 + state.talentEffects.holyVsBurnMultiplier / PERCENT_DENOMINATOR));
    }
  }

  if (effect.damageType === "bleed") {
    if (state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR && state.talentEffects.bleedDesperateMultiplier > 1) {
      rawAmount = Math.floor(rawAmount * state.talentEffects.bleedDesperateMultiplier);
    }
    if (state.enemyHealth <= state.enemyMaxHealth * state.talentEffects.bleedExecuteThreshold / PERCENT_DENOMINATOR) {
      rawAmount = Math.floor(rawAmount * BLEED_EXECUTE_MULTIPLIER);
    }
  }

  return Math.max(0, rawAmount);
}

function applyCrit(damage: number, damageType: string, state: BattleState) {
  const physCritChance = damageType === "physical" ? state.talentEffects.physicalCritChance : 0;
  const totalChance = GLOBAL_CRIT_CHANCE + physCritChance;
  const isCrit = totalChance > 0 && Math.random() * PERCENT_DENOMINATOR < totalChance;
  return isCrit ? damage * CRIT_MULTIPLIER : damage;
}

function applyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0) return state;
  const healAmount = Math.floor(damage * state.talentEffects.healMultiplier);
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  return applyPlayerHealing(state, healAmount);
}

function applyHolyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyLifestealPercent <= 0) return state;
  const healAmount = Math.floor(damage * state.talentEffects.holyLifestealPercent / PERCENT_DENOMINATOR * state.talentEffects.healMultiplier);
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  return applyPlayerHealing(state, healAmount);
}

function applyDamageBlock(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyBlockPercentFromDamage <= 0) return state;
  const blockAmount = Math.floor(damage * state.talentEffects.holyBlockPercentFromDamage / PERCENT_DENOMINATOR);
  if (blockAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: blockAmount });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      block: state.playerStatuses.block + blockAmount,
    },
  };
}

function applyFirstDamageModifiers(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>, rawDamage: number) {
  let nextState = state;
  let nextDamage = rawDamage;

  if (effect.damageType === "burn" && nextState.talentEffects.firstBurnCardDoubled && !nextState.flags.firstBurnCardDoubledUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = { ...nextState, flags: { ...nextState.flags, firstBurnCardDoubledUsed: true } };
  }
  if (effect.damageType === "burn" && nextState.trinketEffects.firstBurnDoubled && !nextState.flags.firstBurnTrinketDoubledUsed) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = { ...nextState, flags: { ...nextState.flags, firstBurnTrinketDoubledUsed: true } };
  }
  if (effect.damageType === "holy" && nextState.trinketEffects.firstHolyDamageBonus > 0 && !nextState.flags.firstHolyDamageBonusUsed) {
    nextDamage += nextState.trinketEffects.firstHolyDamageBonus;
    nextState = { ...nextState, flags: { ...nextState.flags, firstHolyDamageBonusUsed: true } };
  }

  return { state: nextState, rawDamage: nextDamage };
}

function applyForgeStunRider(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>, combatTexts: CombatTextEvent[]) {
  if (effect.damageType !== "physical" || state.trinketEffects.forgeStunThreshold <= 0 || state.playerStatuses.forge < state.trinketEffects.forgeStunThreshold) return state;

  const nextStun = state.enemyStatuses.stun + state.trinketEffects.forgeStunAmount;
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "stun", amount: state.trinketEffects.forgeStunAmount });

  let nextState = { ...state, enemyStatuses: { ...state.enemyStatuses, stun: nextStun } };
  return resolveStunTrigger(nextState);
}

function applyHolyDamageRiders(state: BattleState, card: BattleCard, damage: number, combatTexts: CombatTextEvent[]) {
  let nextState = applyHolyLifesteal(state, damage, combatTexts);
  nextState = applyDamageBlock(nextState, damage, combatTexts);

  if (nextState.talentEffects.holyBurnChance > 0 && Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.holyBurnChance) {
    nextState = {
      ...nextState,
      enemyStatuses: { ...nextState.enemyStatuses, burn: nextState.enemyStatuses.burn + damage },
    };
  }

  if (nextState.talentEffects.holyWishChance > 0 && Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.holyWishChance) {
    const wishOptions = buildWishOptions(nextState, card);
    nextState = nextState.wishOptions
      ? { ...nextState, wishQueue: [...nextState.wishQueue, wishOptions] }
      : { ...nextState, wishOptions };
  }

  return nextState;
}

function applyGoldTroveReward(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (!state.currentEnemy.traits.some((t) => t.id === "gold-trove") || damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: GOLD_TROVE_DAMAGE_REWARD });
  return { ...state, gold: state.gold + GOLD_TROVE_DAMAGE_REWARD };
}

function consumeForgeAfterPhysicalDamage(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>, damage: number) {
  if ((effect.damageType !== "physical" && effect.damageType !== "stun") || damage <= 0 || state.playerStatuses.forge <= 0) return state;
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      forge: state.playerStatuses.forge - 1,
    },
  };
}

export function dealEnemyDamage(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  const modifiedBase = applyFirstDamageModifiers(state, effect, computeBaseDamage(state, effect));
  state = modifiedBase.state;
  const rawDamage = modifiedBase.rawDamage;

  const finalDamage = applyCrit(rawDamage, effect.damageType, state);

  const effectiveArmor = effect.damageType === "physical"
    ? Math.max(0, state.enemyArmor - state.trinketEffects.sunderingArmorPiercing)
    : state.enemyArmor;

  const damageAfterArmor = Math.max(0, finalDamage - effectiveArmor);
  const multiplier = getEnemyDamageMultiplier(state, effect.damageType);
  const modifiedDamage = Math.floor(damageAfterArmor * multiplier);

  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -modifiedDamage, state.enemyMaxHealth),
  };

  nextState = applyBoneCharmHeal(nextState, state.enemyHealth > 0, combatTexts);
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts);
  nextState = applyForgeStunRider(nextState, effect, combatTexts);

  if (effect.lifesteal) {
    nextState = applyLifesteal(nextState, modifiedDamage, combatTexts);
  }

  if (effect.damageType === "holy") {
    nextState = applyHolyDamageRiders(nextState, card, modifiedDamage, combatTexts);
  }

  nextState = applyGoldTroveReward(nextState, modifiedDamage, combatTexts);

  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: modifiedDamage });
  }

  nextState = consumeForgeAfterPhysicalDamage(nextState, effect, modifiedDamage);

  return nextState;
}
