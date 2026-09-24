import type { BattleCardEffect } from "@/lib/game-data";
import { addEnemyStatus, reduceEnemyArmor, setFlag, type BattleState, type CombatTextEvent } from "./types";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHitEpilogue,
  gainManaWithCombatText,
} from "./combat-text";
import { applyCrowdControlTriggerBonuses } from "./bonus-effects";
import { tryTriggerEnemyCc } from "./status-cc";
import { resolveStunTrigger } from "./status-stun-resolve";
import { applyPoisonDamageArmorRider, getEnemyDamageMultiplier, rollTalentChance } from "./status-helpers";
import { getBattleRng, rollPercent } from "@/lib/rng";
import {
  BLEED_STATUS_MULTIPLIER,
  BATTLE_CONFIG,
  BURN_BLEED_MIRROR_CHANCE_PERCENT,
  FREEZE_THRESHOLD_FRACTION,
  MIN_CC_THRESHOLD_FRACTION,
} from "../game-constants";
import { applyGearCcPhysicalDamage } from "./gear-effects";
import { dealEnemyScaledDamage } from "./scaled-damage";
import { applyScaledLeechHealing, computeLeechHeal } from "./damage-rider-leech";
import { detonateEnemyStatuses } from "./dot-resolve";
import { halveRounded } from "./amount-helpers";

function applyGearBurnBleedMirrorLeech(
  state: BattleState,
  actualDamage: number,
  mirrorTarget: "bleed" | "burn",
  combatTexts: CombatTextEvent[],
  alreadyBurningAndBleeding: boolean,
): BattleState {
  if (state.gearEffects.burnBleedMirrorAndLeech <= 0 || actualDamage <= 0) return state;
  let nextState = state;
  if (rollPercent(BURN_BLEED_MIRROR_CHANCE_PERCENT, getBattleRng(nextState))) {
    nextState = addEnemyStatus(nextState, mirrorTarget, actualDamage);
  }
  if (!alreadyBurningAndBleeding) return nextState;
  const healAmount = Math.max(1, halveRounded(actualDamage));
  return applyScaledLeechHealing(nextState, healAmount, combatTexts);
}

function applyBurnStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = addEnemyStatus(state, "burn", actualDamage);
  if (nextState.talentEffects.burnRemovesEnemyArmor) {
    nextState = reduceEnemyArmor(nextState, actualDamage);
  }
  return applyGearBurnBleedMirrorLeech(
    nextState,
    actualDamage,
    "bleed",
    combatTexts,
    state.enemyStatuses.burn > 0 && state.enemyStatuses.bleed > 0,
  );
}

function applyPoisonStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
  allowPoisonBleedConversion = true,
  onPoisonBleedConversion?: (state: BattleState, damage: number, combatTexts: CombatTextEvent[]) => BattleState,
): BattleState {
  let nextState = addEnemyStatus(state, "poison", actualDamage);
  nextState = applyPoisonDamageArmorRider(nextState, actualDamage);
  if (
    actualDamage > 0 &&
    nextState.talentEffects.goldOnFirstPoison > 0 &&
    !nextState.flags.goldOnFirstPoisonThisCombat
  ) {
    const poisonGold = nextState.talentEffects.goldOnFirstPoison;
    nextState = setFlag(addGoldWithCombatText(nextState, poisonGold, combatTexts), "goldOnFirstPoisonThisCombat", true);
  }
  nextState = applyPoisonTalentRiders(
    nextState,
    Math.min(actualDamage, preHitHealth),
    combatTexts,
    allowPoisonBleedConversion,
    onPoisonBleedConversion,
  );
  return nextState;
}

/** Apply Poison status-related Talent riders without changing the base packet. */
export function applyPoisonTalentRiders(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  allowPoisonBleedConversion = true,
  onPoisonBleedConversion?: (state: BattleState, damage: number, combatTexts: CombatTextEvent[]) => BattleState,
): BattleState {
  let nextState = state;
  if (nextState.talentEffects.poisonStripArmor) {
    nextState = reduceEnemyArmor(nextState, 1);
  }
  if (damage > 0) {
    const leechChances = [
      state.trinketEffects.parasiticBloomLeechChance,
      state.talentEffects.poisonLeechChance + state.gearEffects.poisonLeechChance,
    ];
    for (const chance of leechChances) {
      if (!rollTalentChance(chance, nextState)) continue;
      nextState = applyScaledLeechHealing(nextState, computeLeechHeal(damage), combatTexts, { afflicted: true });
    }
    if (
      allowPoisonBleedConversion &&
      onPoisonBleedConversion &&
      rollTalentChance(nextState.talentEffects.poisonBleedDamageChance, nextState)
    ) {
      nextState = onPoisonBleedConversion(nextState, damage, combatTexts);
    }
  }
  return nextState;
}

function stackBleed(state: BattleState, statusDamage: number): BattleState {
  const bleedAmount = statusDamage * BLEED_STATUS_MULTIPLIER;
  return addEnemyStatus(state, "bleed", bleedAmount);
}

function queueBleedLeech(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  bleedAmount: number,
): BattleState {
  if (bleedAmount <= 0) return state;
  const leechFromCard = effect.lifesteal;
  const leechFromTalent = rollTalentChance(state.talentEffects.bleedLeechChance, state);
  if (!leechFromCard && !leechFromTalent) return state;
  return { ...state, pendingBleedLeechHealing: state.pendingBleedLeechHealing + bleedAmount };
}

function procBleedPoison(state: BattleState, actualDamage: number, bleedAmount: number): BattleState {
  if (
    bleedAmount <= 0 ||
    actualDamage <= 0 ||
    state.talentEffects.bleedPoisonChance <= 0 ||
    !rollTalentChance(state.talentEffects.bleedPoisonChance, state)
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
  let nextState = stackBleed(state, actualDamage);
  const bleedAmount = nextState.enemyStatuses.bleed - state.enemyStatuses.bleed;
  if (actualDamage > 0 && rollTalentChance(nextState.talentEffects.bleedHalveArmorChance, nextState)) {
    const halved = halveRounded(nextState.enemyMitigation.armor);
    const removed = nextState.enemyMitigation.armor - halved;
    if (removed > 0) nextState = reduceEnemyArmor(nextState, removed);
  }
  nextState = queueBleedLeech(nextState, effect, bleedAmount);
  nextState = procBleedPoison(nextState, actualDamage, bleedAmount);
  nextState = applyGearBurnBleedMirrorLeech(
    nextState,
    actualDamage,
    "burn",
    combatTexts,
    state.enemyStatuses.burn > 0 && state.enemyStatuses.bleed > 0,
  );
  return awardCutpurseGold(nextState, bleedAmount, combatTexts);
}

function applyStunStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
  fromHolyDamage = false,
): BattleState {
  return resolveStunTrigger(addEnemyStatus(state, "stun", actualDamage), combatTexts, preHitHealth, fromHolyDamage);
}

function applyFrozenHeartDamage(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.trinketEffects.frozenHeartDamage <= 0) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  return dealEnemyScaledDamage(state, state.trinketEffects.frozenHeartDamage, "physical", combatTexts, {
    multiplier: getEnemyDamageMultiplier(state, "physical"),
    riders: (damagedState) => applyHitEpilogue(damagedState, state.enemyHealth, enemyWasAlive, combatTexts),
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
  const freezeThreshold = Math.max(
    MIN_CC_THRESHOLD_FRACTION,
    FREEZE_THRESHOLD_FRACTION - preHitState.talentEffects.freezeThresholdReduction,
  );
  const triggered = tryTriggerEnemyCc({
    preHitHealth,
    nextState,
    stat: "freeze",
    stackValue: nextState.enemyStatuses.freeze,
    thresholdFraction: freezeThreshold,
    // Immunity is judged on the latest state, matching the stun path.
    ccCooldown: nextState.enemyCC.cooldown,
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + nextState.trinketEffects.freezeDurationExtension,
    combatTexts,
  });
  if (!triggered) return nextState;

  if (triggered.kind === "immune") return triggered.state;

  let result = preHitState.talentEffects.archeryCritOnCrowdControl
    ? setFlag(triggered.state, "hawkEyeReady", true)
    : triggered.state;
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
  if (result.gearEffects.freezeGrantsBlockAndMana > 0 && preHitState.mana === 0) {
    const manaGain = halveRounded(result.playerStatuses.block);
    result = gainManaWithCombatText(result, manaGain, combatTexts, { skipFightPacing: true });
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
  if (nextState.gearEffects.freezeGrantsBlockAndMana > 0 && actualDamage > 0 && state.playerStatuses.block === 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", actualDamage, combatTexts, {
      skipFightPacing: true,
    });
  }
  return tryTriggerEnemyFreeze(state, nextState, combatTexts, preHitHealth);
}

function applyPhysicalBleedChance(
  state: BattleState,
  actualDamage: number,
  allowTalentChanceProcs = true,
): BattleState {
  const bleedChance =
    (allowTalentChanceProcs ? state.talentEffects.physicalBleedChance : 0) + state.gearEffects.physicalBleedChance;
  if (actualDamage <= 0 || !rollTalentChance(bleedChance, state)) return state;
  return addEnemyStatus(state, "bleed", actualDamage);
}

function applyPhysicalBleedDetonate(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (
    (!state.talentEffects.physicalDetonatesBleed && state.gearEffects.physicalCritDetonatesBleed <= 0) ||
    state.enemyStatuses.bleed <= 0
  )
    return state;
  return detonateEnemyStatuses(state, ["bleed"], combatTexts);
}

function applyPhysicalShieldSlamArmorStrip(state: BattleState, actualDamage: number, forge: number): BattleState {
  let nextState = state;
  if (actualDamage > 0 && state.talentEffects.physicalStripArmorByForge && forge > 0) {
    nextState = reduceEnemyArmor(nextState, forge);
  }
  if (state.talentEffects.physicalStripArmorWhileBlocked && state.playerStatuses.block > 0) {
    nextState = reduceEnemyArmor(nextState, 2);
  }
  return nextState;
}

function applyPhysicalStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  critical = false,
  allowTalentChanceProcs = true,
  forgeBeforeHit = state.playerStatuses.forge,
): BattleState {
  let nextState = applyPhysicalBleedChance(state, actualDamage, allowTalentChanceProcs);
  if (actualDamage > 0 && critical) nextState = applyPhysicalBleedDetonate(nextState, combatTexts);
  nextState = applyPhysicalShieldSlamArmorStrip(nextState, actualDamage, forgeBeforeHit);
  return nextState;
}

export function applyDamageStatuses(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
  options: {
    allowPoisonBleedConversion?: boolean;
    onPoisonBleedConversion?: (state: BattleState, damage: number, combatTexts: CombatTextEvent[]) => BattleState;
    critical?: boolean;
    forgeBeforeHit?: number;
    allowTalentChanceProcs?: boolean;
  } = {},
) {
  switch (effect.damageType) {
    case "burn":
      return applyBurnStatusRider(state, actualDamage, combatTexts);
    case "poison":
      return applyPoisonStatusRider(
        state,
        actualDamage,
        combatTexts,
        preHitHealth,
        options.allowPoisonBleedConversion ?? true,
        options.onPoisonBleedConversion,
      );
    case "bleed":
      return applyBleedStatusRider(state, effect, actualDamage, combatTexts);
    case "stun":
      return applyStunStatusRider(state, actualDamage, combatTexts, preHitHealth);
    case "freeze":
      return applyFreezeStatusRider(state, actualDamage, combatTexts, preHitHealth);
    case "physical":
      return applyPhysicalStatusRider(
        state,
        actualDamage,
        combatTexts,
        options.critical,
        options.allowTalentChanceProcs,
        options.forgeBeforeHit,
      );
    case "holy":
      if (state.gearEffects.holyStunBuildupGold > 0 && actualDamage > 0) {
        return applyStunStatusRider(state, actualDamage, combatTexts, preHitHealth, true);
      }
      return state;
    case "nature":
      return state;
  }
}
