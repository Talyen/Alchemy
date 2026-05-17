// Player card damage to the current enemy: base damage, crit, armor reduction, trait multipliers, and riders.
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

  let rawAmount: number;
  if (effect.equalToBlock) {
    rawAmount = state.playerStatuses.block + forgeBonus;
  } else if (effect.equalToArmor) {
    rawAmount = state.playerStatuses.armor + forgeBonus;
  } else {
    rawAmount = effect.amount + forgeBonus;
  }

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
    rawAmount += Math.floor((state.gold * state.talentEffects.holyGoldPercent) / PERCENT_DENOMINATOR);
    rawAmount += Math.floor((state.playerStatuses.block * state.talentEffects.holyBlockPercent) / PERCENT_DENOMINATOR);
    if (state.enemyStatuses.burn > 0) {
      rawAmount = Math.floor(rawAmount * (1 + state.talentEffects.holyVsBurnMultiplier / PERCENT_DENOMINATOR));
    }
  }

  if (effect.damageType === "bleed") {
    if (
      state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR &&
      state.talentEffects.bleedDesperateMultiplier > 1
    ) {
      rawAmount = Math.floor(rawAmount * state.talentEffects.bleedDesperateMultiplier);
    }
    if (state.enemyHealth <= (state.enemyMaxHealth * state.talentEffects.bleedExecuteThreshold) / PERCENT_DENOMINATOR) {
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
  const healAmount = Math.floor(
    ((damage * state.talentEffects.holyLifestealPercent) / PERCENT_DENOMINATOR) * state.talentEffects.healMultiplier,
  );
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  return applyPlayerHealing(state, healAmount);
}

function applyDamageBlock(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0 || state.talentEffects.holyBlockPercentFromDamage <= 0) return state;
  const blockAmount = Math.floor((damage * state.talentEffects.holyBlockPercentFromDamage) / PERCENT_DENOMINATOR);
  if (blockAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: blockAmount });
  return addPlayerStatus(state, "block", blockAmount);
}

function applyFirstDamageModifiers(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  rawDamage: number,
) {
  let nextState = state;
  let nextDamage = rawDamage;

  if (
    effect.damageType === "burn" &&
    nextState.talentEffects.firstBurnCardDoubled &&
    !nextState.flags.firstBurnCardDoubledUsed
  ) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstBurnCardDoubledUsed", true);
  }
  if (
    effect.damageType === "burn" &&
    nextState.trinketEffects.firstBurnDoubled &&
    !nextState.flags.firstBurnTrinketDoubledUsed
  ) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstBurnTrinketDoubledUsed", true);
  }
  if (
    effect.damageType === "holy" &&
    nextState.trinketEffects.firstHolyDamageDoubled &&
    !nextState.flags.firstHolyDamageBonusUsed
  ) {
    nextDamage *= FIRST_EFFECT_MULTIPLIER;
    nextState = setFlag(nextState, "firstHolyDamageBonusUsed", true);
  }

  return { state: nextState, rawDamage: nextDamage };
}

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

function applyHolyDamageRiders(state: BattleState, card: BattleCard, damage: number, combatTexts: CombatTextEvent[]) {
  let nextState = applyHolyLifesteal(state, damage, combatTexts);
  nextState = applyDamageBlock(nextState, damage, combatTexts);

  if (
    nextState.talentEffects.holyBurnChance > 0 &&
    Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.holyBurnChance
  ) {
    const burnAmount = isNullFieldActive(nextState) ? Math.max(1, Math.floor(damage / 2)) : damage;
    nextState = {
      ...nextState,
      enemyStatuses: { ...nextState.enemyStatuses, burn: nextState.enemyStatuses.burn + burnAmount },
    };
  }

  if (
    nextState.talentEffects.holyWishChance > 0 &&
    Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.holyWishChance
  ) {
    nextState = applyWishEffect(nextState, card, 1, combatTexts);
  }

  return nextState;
}

function applyGoldTroveReward(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (!state.currentEnemy.traits.some((t) => t.id === "gold-trove") || damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: GOLD_TROVE_DAMAGE_REWARD });
  return addGold(state, GOLD_TROVE_DAMAGE_REWARD);
}

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
      forge: state.playerStatuses.forge - 1,
    },
  };
}

function computeCardDamageToEnemy(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>) {
  const modifiedBase = applyFirstDamageModifiers(state, effect, computeBaseDamage(state, effect));
  const rawDamage = modifiedBase.rawDamage;
  const finalDamage = applyCrit(rawDamage, effect.damageType, modifiedBase.state);
  const effectiveArmor =
    effect.damageType === "physical"
      ? Math.max(0, state.enemyArmor - state.trinketEffects.sunderingArmorPiercing)
      : state.enemyArmor;
  const damageAfterArmor = Math.max(0, finalDamage - effectiveArmor);
  const multiplier = getEnemyDamageMultiplier(state, effect.damageType);
  return { nextState: modifiedBase.state, modifiedDamage: Math.floor(damageAfterArmor * multiplier) };
}

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

export function dealDamageToEnemy(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  const { nextState, modifiedDamage } = computeCardDamageToEnemy(state, effect);
  return applyDamageRiders(nextState, card, effect, modifiedDamage, combatTexts);
}
