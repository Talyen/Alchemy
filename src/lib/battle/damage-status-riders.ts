import type { BattleCardEffect } from "@/lib/game-data";
import {
  addEnemyStatus,
  addPlayerStatus,
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
import { getBattleRng, getEnemyDamageMultiplier, rollPercent } from "./status-helpers";
import { BLEED_STATUS_MULTIPLIER, BATTLE_CONFIG, FREEZE_THRESHOLD_FRACTION, HALF_DIVISOR } from "../game-constants";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage, scaledGearLeechHeal } from "./gear-effects";
import { computeLeechHeal } from "./leech-heal";
import { payKillPayouts } from "./kill-payouts";
import { detonateEnemyStatuses } from "./dot-resolve";

const BURN_BLEED_MIRROR_CHANCE = 20;

function applyGearBurnBleedMirrorLeech(
  state: BattleState,
  actualDamage: number,
  mirrorTarget: "bleed" | "burn",
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.gearEffects.burnBleedMirrorAndLeech <= 0 || actualDamage <= 0) return state;
  let nextState = state;
  if (rollPercent(BURN_BLEED_MIRROR_CHANCE, nextState.rng)) {
    nextState = addEnemyStatus(nextState, mirrorTarget, actualDamage);
  }
  const healAmount = Math.max(1, Math.round(actualDamage / HALF_DIVISOR));
  return applyHealingWithCombatText(nextState, healAmount, combatTexts, { skipFightPacing: true });
}

function applyBurnStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = addEnemyStatus(state, "burn", actualDamage);
  if (nextState.talentEffects.burnRemovesEnemyArmor) {
    nextState = reduceEnemyArmor(nextState, actualDamage);
  }
  return applyGearBurnBleedMirrorLeech(nextState, actualDamage, "bleed", combatTexts);
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
  const leechFromTalent = rollPercent(state.talentEffects.bleedLeechChance, getBattleRng(state));
  if (!leechFromCard && !leechFromTalent) return state;
  return { ...state, pendingBleedLeechHealing: state.pendingBleedLeechHealing + bleedAmount };
}

function procBleedPoison(state: BattleState, actualDamage: number, bleedAmount: number): BattleState {
  if (
    bleedAmount <= 0 ||
    actualDamage <= 0 ||
    state.talentEffects.bleedPoisonChance <= 0 ||
    !rollPercent(state.talentEffects.bleedPoisonChance, getBattleRng(state))
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
  nextState = applyGearBurnBleedMirrorLeech(nextState, actualDamage, "burn", combatTexts);
  return awardCutpurseGold(nextState, bleedAmount, combatTexts);
}

function applyStunStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
  fromHolyBuildup = false,
): BattleState {
  return resolveStunTrigger(addEnemyStatus(state, "stun", actualDamage), combatTexts, preHitHealth, fromHolyBuildup);
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

  if (triggered.kind === "immune") return triggered.state;

  let result = triggered.state;
  result = applyFrozenHeartDamage(result, combatTexts);
  result = applyGearFreezeDamage(preHitState, result, combatTexts);
  result = applyCrowdControlTriggerBonuses(
    result,
    {
      block: result.talentEffects.blockOnFreeze,
      stripArmor: result.talentEffects.freezeStripArmor,
      stripBlock: result.talentEffects.freezeStripBlock,
    },
    combatTexts,
  );
  if (result.gearEffects.freezeGrantsBlockAndMana > 0) {
    const manaGain = Math.min(4, Math.round(result.playerStatuses.block / 2));
    if (manaGain > 0) {
      result = { ...result, mana: Math.min(result.maxMana, result.mana + manaGain) };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: manaGain });
    }
  }
  return result;
}

function applyFreezeStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
): BattleState {
  let nextState = addEnemyStatus(state, "freeze", actualDamage);
  if (nextState.gearEffects.freezeGrantsBlockAndMana > 0 && actualDamage > 0) {
    nextState = addPlayerStatus(nextState, "block", actualDamage);
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: actualDamage });
  }
  return tryTriggerEnemyFreeze(state, nextState, combatTexts, preHitHealth);
}

function applyPhysicalBleedChance(state: BattleState, actualDamage: number): BattleState {
  const bleedChance = state.talentEffects.physicalBleedChance + state.gearEffects.physicalBleedChance;
  if (actualDamage <= 0 || !rollPercent(bleedChance, getBattleRng(state))) return state;
  return addEnemyStatus(state, "bleed", actualDamage);
}

function applyPhysicalBleedDetonate(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.talentEffects.physicalDetonatesBleed || state.enemyStatuses.bleed <= 0) return state;
  return detonateEnemyStatuses(state, ["bleed"], combatTexts);
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

export function applyDamageStatuses(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
) {
  switch (effect.damageType) {
    case "burn":
      return applyBurnStatusRider(state, actualDamage, combatTexts);
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
    case "holy":
      if (state.gearEffects.holyStunBuildupGold > 0 && actualDamage > 0) {
        return applyStunStatusRider(state, actualDamage, combatTexts, preHitHealth, true);
      }
      return state;
    default:
      return state;
  }
}
