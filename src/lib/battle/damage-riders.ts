/**
 * Secondary damage riders: statuses, lifesteal, forge decay, and combat text.
 */
import { forgeAppliesToDamageType } from "./damage-calc";
import { applyDamageStatuses, resolveStunTrigger } from "./status-effects";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { applyBoneCharmHeal, applyLuckyCloverGold } from "./trinket-effects";
import { applyWishEffect } from "./wish";
import { rollPercent, getBattleRng } from "./status-helpers";
import { type BattleCard, type BattleCardEffect, type PlayerStatusId } from "@/lib/game-data";
import {
  addEnemyStatus,
  addGold,
  addPlayerStatus,
  applyPlayerHealing,
  clampHealth,
  setFlag,
  type BattleState,
  type CombatTextEvent,
  type EnemyMitigation,
} from "./types";
import {
  BATTLE_CONFIG,
  computeLeechHeal,
  FIRST_EFFECT_MULTIPLIER,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
} from "../game-constants";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-events";

function rollTalentChance(chance: number, state: { rng?: () => number }): boolean {
  return chance > 0 && rollPercent(chance, getBattleRng(state));
}

function executePlayerHealing(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const healAmount = Math.round(amount * state.talentEffects.healMultiplier);
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  const nextState = applyPlayerHealing(state, healAmount);
  emitOverhealBlockText(state, nextState, combatTexts);
  return nextState;
}

function applyLeechBleedRider(state: BattleState, damage: number): BattleState {
  if (rollTalentChance(state.talentEffects.leechBleedChance, state)) {
    return addEnemyStatus(state, "bleed", damage);
  }
  return state;
}

function applyLeechManaRider(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (rollTalentChance(state.talentEffects.manaOnLeechChance, state)) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: 1 });
    return { ...state, mana: state.mana + 1 };
  }
  return state;
}

function applyLeechBoonSiphonRider(state: BattleState): BattleState {
  if (rollTalentChance(state.talentEffects.boonSiphonChance, state)) {
    const mit = state.enemyMitigation;
    const pool: { key: keyof EnemyMitigation; status: PlayerStatusId }[] = [];
    if (mit.forge > 0) pool.push({ key: "forge", status: "forge" });
    if (mit.armor > 0) pool.push({ key: "armor", status: "armor" });
    if (mit.block > 0) pool.push({ key: "block", status: "block" });
    if (pool.length > 0) {
      const steal = pool[Math.trunc(getBattleRng(state)() * pool.length)];
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
  if (rollTalentChance(state.talentEffects.leechPoisonChance, state)) {
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

  let healAmount = computeLeechHeal(damage);

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
  if (damage <= 0 || !rollTalentChance(state.talentEffects.natureLeechChance, state)) return state;
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
  if (getBattleRng(state)() * PERCENT_DENOMINATOR < state.talentEffects.holyGoldChance) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: damage });
    return addGold(state, damage);
  }
  return state;
}

/**
 * Applies first-time burn multipliers from talents and trinkets, updating state in place.
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

function applyBurnDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (state.talentEffects.forgeOnBurnDealt > 0) {
    nextState = addPlayerStatus(nextState, "forge", state.talentEffects.forgeOnBurnDealt);
  }
  if (rollTalentChance(state.talentEffects.burnStunChance, state)) {
    nextState = resolveStunTrigger(addEnemyStatus(nextState, "stun", modifiedDamage), combatTexts);
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
    nextState = addEnemyStatus(nextState, "burn", damage);
  }

  if (
    nextState.talentEffects.holyWishChance > 0 &&
    nextState.rng() * PERCENT_DENOMINATOR < nextState.talentEffects.holyWishChance
  ) {
    nextState = applyWishEffect(nextState, card, 1, combatTexts);
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
  const forgeWasApplied = forgeAppliesToDamageType(effect.damageType, state.talentEffects);

  if (!forgeWasApplied || damage <= 0 || state.playerStatuses.forge <= 0) return state;

  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      forge: Math.max(0, state.playerStatuses.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT),
    },
  };
}

export function applyDamageRiders(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
) {
  const previousHealth = state.enemyHealth;
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
    nextState = applyBurnDamageRiders(nextState, modifiedDamage, combatTexts);
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

  nextState = processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);

  return consumeForgeAfterDamage(nextState, effect, modifiedDamage);
}
