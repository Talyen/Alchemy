/**
 * Secondary damage riders: statuses, lifesteal, forge decay, and combat text.
 */
import { forgeAppliesToDamageType } from "./damage-calc";
import { applyDamageStatuses } from "./damage-status-riders";
import { mergeCombatText } from "./combat-text";
import { applyBoneCharmHeal, applyLuckyCloverGold } from "./trinket-effects";
import { addGoldWithCombatText } from "./combat-text";
import { applyGearKillRewards } from "./gear-effects";
import { applyWishEffect } from "./wish";
import {
  applyDamageBlock,
  applyHolyLifesteal,
  applyHolyTithe,
  applyLifestealAndPlayerHitTriggers,
  applyNatureLeech,
} from "./damage-rider-leech";
import { rollTalentChance } from "./status-helpers";
import { type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import { addEnemyStatus, addPlayerStatus, clampHealth, type BattleState, type CombatTextEvent } from "./types";
import { BATTLE_CONFIG, HALF_DIVISOR } from "../game-constants";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-events";
import { decayArmorAfterDamage } from "./status-helpers";
import { dealPlayerTypedHit } from "./player-typed-hit";

function applyBurnDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (state.talentEffects.forgeOnBurnDealt > 0) {
    nextState = addPlayerStatus(nextState, "forge", state.talentEffects.forgeOnBurnDealt);
  }
  if (state.gearEffects.forgeOnBurnDealt > 0) {
    nextState = addPlayerStatus(nextState, "forge", state.gearEffects.forgeOnBurnDealt);
  }
  if (rollTalentChance(state.talentEffects.burnStunChance, state)) {
    nextState = dealPlayerTypedHit(nextState, "stun", modifiedDamage, combatTexts);
  }
  return nextState;
}

function applyNatureDamageRiders(
  state: BattleState,
  modifiedDamage: number,
  _card: BattleCard,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = applyLuckyCloverGold(state, modifiedDamage, combatTexts);
  if (state.talentEffects.natureLeechChance > 0 || state.gearEffects.natureLeechChance > 0) {
    nextState = applyNatureLeech(nextState, modifiedDamage, combatTexts);
  }
  if (rollTalentChance(state.talentEffects.naturePoisonChance, state)) {
    nextState = addEnemyStatus(nextState, "poison", modifiedDamage);
  }
  if (rollTalentChance(state.talentEffects.natureBleedChance, state)) {
    nextState = addEnemyStatus(nextState, "bleed", modifiedDamage);
  }
  if (rollTalentChance(state.talentEffects.natureStunChance, state)) {
    nextState = dealPlayerTypedHit(nextState, "stun", modifiedDamage, combatTexts);
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

  return dealPlayerTypedHit(state, "stun", state.trinketEffects.forgeStunAmount, combatTexts);
}

/**
 * Applies riders specific to holy damage: lifesteal, block gain, burn chance, and wish chance.
 */
function applyHolyDamageRiders(state: BattleState, card: BattleCard, damage: number, combatTexts: CombatTextEvent[]) {
  let nextState = applyHolyLifesteal(state, damage, combatTexts);
  nextState = applyDamageBlock(nextState, damage, combatTexts);
  nextState = applyHolyTithe(nextState, damage, combatTexts);

  if (rollTalentChance(nextState.talentEffects.holyBurnChance, nextState)) {
    nextState = addEnemyStatus(nextState, "burn", damage);
  }

  if (rollTalentChance(nextState.talentEffects.holyWishChance, nextState)) {
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
  isExtraHit = false,
) {
  const previousHealth = state.enemyHealth;
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -modifiedDamage, state.enemyMaxHealth),
  };

  nextState = decayArmorAfterDamage(nextState, modifiedDamage, "enemy");
  // boneCharmHeal uses state.enemyHealth > 0 (pre-hit state), not nextState,
  // so heal-on-kill only triggers if the enemy WAS alive before this hit.
  nextState = applyBoneCharmHeal(nextState, state.enemyHealth > 0, combatTexts);
  nextState = applyGearKillRewards(nextState, state.enemyHealth > 0, combatTexts);
  if (
    card.tags?.includes("archery") &&
    nextState.talentEffects.goldOnArcheryKill > 0 &&
    previousHealth > 0 &&
    nextState.enemyHealth <= 0
  ) {
    nextState = addGoldWithCombatText(nextState, nextState.talentEffects.goldOnArcheryKill, combatTexts);
  }
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts, previousHealth);
  nextState = applyForgeStunRider(nextState, effect, combatTexts);
  if (effect.damageType === "physical" && modifiedDamage > 0) {
    const stunChance = nextState.talentEffects.physicalStunChance + nextState.gearEffects.physicalStunChance;
    if (rollTalentChance(stunChance, nextState)) {
      nextState = dealPlayerTypedHit(nextState, "stun", modifiedDamage, combatTexts);
    }
  }
  if (effect.damageType === "poison" && modifiedDamage > 0) {
    if (rollTalentChance(nextState.talentEffects.poisonStunChance, nextState)) {
      nextState = dealPlayerTypedHit(nextState, "stun", modifiedDamage, combatTexts);
    }
  }

  if (effect.damageType === "burn" && modifiedDamage > 0) {
    nextState = applyBurnDamageRiders(nextState, modifiedDamage, combatTexts);
  }

  if (effect.lifesteal) {
    nextState = applyLifestealAndPlayerHitTriggers(nextState, modifiedDamage, combatTexts);
  }

  if (card.tags?.includes("archery") && modifiedDamage > 0) {
    if (!isExtraHit && rollTalentChance(state.talentEffects.archeryPlayTwiceChance, state)) {
      const secondHit = Math.round(modifiedDamage / HALF_DIVISOR);
      nextState = applyDamageRiders(nextState, card, effect, secondHit, combatTexts, true);
    }
    if (rollTalentChance(state.talentEffects.archeryBleedChance, state)) {
      nextState = addEnemyStatus(nextState, "bleed", modifiedDamage);
    }
  }
  if (effect.damageType === "holy") {
    nextState = applyHolyDamageRiders(nextState, card, modifiedDamage, combatTexts);
  }

  if (effect.damageType === "nature") {
    nextState = applyNatureDamageRiders(nextState, modifiedDamage, card, combatTexts);
  }

  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: modifiedDamage });
  }

  nextState = processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);

  return consumeForgeAfterDamage(nextState, effect, modifiedDamage);
}
