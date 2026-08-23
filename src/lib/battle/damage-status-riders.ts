/**
 * Applies per-damage-type status riders (burn/poison/bleed/stun/freeze/physical)
 * when a damage hit lands, and resolves the freeze CC trigger.
 * Depends on: ./types, ./combat-text, ./talent-effects, ./status-cc, ./status-stun-resolve,
 * ./status-helpers, ./gear-effects, ./trinket-effects, ../game-constants.
 * Depended on by: ./status-ticks, ./damage-riders, ./effect-handlers, ./status-player.
 */
import type { BattleCardEffect } from "@/lib/game-data";
import {
  addEnemyStatus,
  clampHealth,
  reduceEnemyArmor,
  setEnemyStatus,
  setFlag,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { addGoldWithCombatText, applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { applyCrowdControlTriggerBonuses } from "./talent-effects";
import { tryTriggerEnemyCc } from "./status-cc";
import { resolveStunTrigger } from "./status-stun-resolve";
import { decayArmorAfterDamage, getEnemyDamageMultiplier, rollPercent } from "./status-helpers";
import { BLEED_STATUS_MULTIPLIER, BATTLE_CONFIG, computeLeechHeal, FREEZE_THRESHOLD_FRACTION } from "../game-constants";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage, scaledGearLeechHeal } from "./gear-effects";
import { payKillPayouts } from "./kill-payouts";

function applyBurnStatusRider(state: BattleState, actualDamage: number): BattleState {
  let nextState = addEnemyStatus(state, "burn", actualDamage);
  if (nextState.talentEffects.burnRemovesEnemyArmor) {
    nextState = reduceEnemyArmor(nextState, actualDamage);
  }
  return nextState;
}

function applyPoisonStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = addEnemyStatus(state, "poison", actualDamage);
  if (
    actualDamage > 0 &&
    nextState.talentEffects.goldOnFirstPoison > 0 &&
    !nextState.flags.goldOnFirstPoisonThisCombat
  ) {
    const poisonGold = nextState.talentEffects.goldOnFirstPoison;
    nextState = setFlag(addGoldWithCombatText(nextState, poisonGold, combatTexts), "goldOnFirstPoisonThisCombat", true);
  }
  nextState = applyPoisonTalentRiders(nextState, actualDamage, combatTexts);
  return nextState;
}

export function applyPoisonTalentRiders(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (nextState.talentEffects.poisonStripArmor) {
    nextState = reduceEnemyArmor(nextState, 1);
  }
  if (damage > 0) {
    const leechChance = nextState.talentEffects.poisonLeechChance + nextState.gearEffects.poisonLeechChance;
    if (rollPercent(leechChance, nextState.rng)) {
      nextState = applyHealingWithCombatText(
        nextState,
        scaledGearLeechHeal(computeLeechHeal(damage), nextState.gearEffects),
        combatTexts,
        { skipFightPacing: true },
      );
    }
  }
  return nextState;
}

function stackBleed(state: BattleState, statusDamage: number): BattleState {
  const bleedAmount = statusDamage * BLEED_STATUS_MULTIPLIER;
  return setEnemyStatus(state, "bleed", state.enemyStatuses.bleed + bleedAmount);
}

function queueBleedLeech(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  bleedAmount: number,
): BattleState {
  if (bleedAmount <= 0) return state;
  const leechFromCard = effect.lifesteal;
  const leechFromTalent = rollPercent(state.talentEffects.bleedLeechChance, state.rng);
  if (!leechFromCard && !leechFromTalent) return state;
  return { ...state, pendingBleedLeechHealing: state.pendingBleedLeechHealing + bleedAmount };
}

function procBleedPoison(state: BattleState, actualDamage: number, bleedAmount: number): BattleState {
  if (
    bleedAmount <= 0 ||
    actualDamage <= 0 ||
    state.talentEffects.bleedPoisonChance <= 0 ||
    !rollPercent(state.talentEffects.bleedPoisonChance, state.rng)
  )
    return state;
  return addEnemyStatus(state, "poison", actualDamage);
}

function awardCutpurseGold(state: BattleState, bleedAmount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (bleedAmount <= 0 || state.trinketEffects.cutpurseGoldOnBleed <= 0) return state;
  return addGoldWithCombatText(state, state.trinketEffects.cutpurseGoldOnBleed, combatTexts);
}

function applyBleedStatusRider(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const bleedAmount = actualDamage * BLEED_STATUS_MULTIPLIER;
  let nextState = stackBleed(state, actualDamage);
  nextState = queueBleedLeech(nextState, effect, bleedAmount);
  nextState = procBleedPoison(nextState, actualDamage, bleedAmount);
  return awardCutpurseGold(nextState, bleedAmount, combatTexts);
}

function applyStunStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
): BattleState {
  return resolveStunTrigger(addEnemyStatus(state, "stun", actualDamage), combatTexts, preHitHealth);
}

function applyFrozenHeartDamage(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.trinketEffects.frozenHeartDamage <= 0) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  return dealEnemyScaledDamage(state, state.trinketEffects.frozenHeartDamage, "physical", combatTexts, {
    multiplier: getEnemyDamageMultiplier(state, "physical"),
    riders: (damagedState) => payKillPayouts(damagedState, enemyWasAlive, combatTexts),
  });
}

function applyGearFreezeDamage(
  preHitState: BattleState,
  state: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  return applyGearCcPhysicalDamage(state, preHitState.gearEffects.damageOnFreezePhysical, combatTexts);
}

export function tryTriggerEnemyFreeze(
  preHitState: BattleState,
  nextState: BattleState,
  combatTexts: CombatTextEvent[],
  preHitHealth = preHitState.enemyHealth,
): BattleState {
  const freezeThreshold = FREEZE_THRESHOLD_FRACTION - preHitState.talentEffects.freezeThresholdReduction;
  const triggered = tryTriggerEnemyCc({
    preHitHealth,
    nextState,
    stat: "freeze",
    stackValue: nextState.enemyStatuses.freeze,
    thresholdFraction: freezeThreshold,
    ccCooldown: preHitState.enemyCC.cooldown,
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + nextState.trinketEffects.freezeDurationExtension,
    combatTexts,
  });
  if (!triggered) return nextState;
  // CC immunity clears the stack without a freeze — no freeze rewards for a freeze that didn't land.
  if (triggered.kind === "immune") return triggered.state;

  let result = triggered.state;
  result = applyFrozenHeartDamage(result, combatTexts);
  result = applyGearFreezeDamage(preHitState, result, combatTexts);
  result = applyCrowdControlTriggerBonuses(
    result,
    {
      block: result.talentEffects.blockOnFreeze,
      stripArmor: result.talentEffects.freezeStripArmor,
    },
    combatTexts,
  );
  return result;
}

function applyFreezeStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
): BattleState {
  const nextState = addEnemyStatus(state, "freeze", actualDamage);
  return tryTriggerEnemyFreeze(state, nextState, combatTexts, preHitHealth);
}

function applyPhysicalBleedChance(state: BattleState, actualDamage: number): BattleState {
  const bleedChance = state.talentEffects.physicalBleedChance + state.gearEffects.physicalBleedChance;
  if (actualDamage <= 0 || !rollPercent(bleedChance, state.rng)) return state;
  return addEnemyStatus(state, "bleed", actualDamage);
}

function applyPhysicalBleedDetonate(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.talentEffects.physicalDetonatesBleed || state.enemyStatuses.bleed <= 0) return state;
  const bleedDamage = state.enemyStatuses.bleed;
  const multiplier = getEnemyDamageMultiplier(state, "bleed");
  const finalDamage = Math.round(bleedDamage * multiplier);
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
    pendingBleedLeechHealing: 0,
  };
  // Same placement as dealEnemyDotTick: payouts fire right after the health
  // transition, ahead of any follow-up riders.
  nextState = payKillPayouts(nextState, state.enemyHealth > 0, combatTexts);
  nextState = setEnemyStatus(nextState, "bleed", 0);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: finalDamage });
  nextState = decayArmorAfterDamage(nextState, finalDamage, "enemy", combatTexts);
  // Detonation is the bleed burst, so it pays the queued leech just like tickBleed.
  const leechAmount = state.pendingBleedLeechHealing;
  if (leechAmount > 0) {
    nextState = applyHealingWithCombatText(
      nextState,
      scaledGearLeechHeal(computeLeechHeal(leechAmount), nextState.gearEffects),
      combatTexts,
      { skipFightPacing: true },
    );
  }
  return nextState;
}

function applyPhysicalStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = applyPhysicalBleedChance(state, actualDamage);
  nextState = applyPhysicalBleedDetonate(nextState, combatTexts);
  return nextState;
}

/**
 * Dispatches the per-type status rider; holy/nature deal damage without riders.
 */
export function applyDamageStatuses(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
) {
  switch (effect.damageType) {
    case "burn":
      return applyBurnStatusRider(state, actualDamage);
    case "poison":
      return applyPoisonStatusRider(state, actualDamage, combatTexts);
    case "bleed":
      return applyBleedStatusRider(state, effect, actualDamage, combatTexts);
    case "stun":
      return applyStunStatusRider(state, actualDamage, combatTexts, preHitHealth);
    case "freeze":
      return applyFreezeStatusRider(state, actualDamage, combatTexts, preHitHealth);
    case "physical":
      return applyPhysicalStatusRider(state, actualDamage, combatTexts);
    default:
      return state;
  }
}
