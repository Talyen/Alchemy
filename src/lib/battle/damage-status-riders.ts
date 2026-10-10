import { rollBattleChance } from "./chance-roll";
import type { BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyStatus } from "./status-state";
import { reduceEnemyArmor } from "./enemy-mitigation-state";
import { writeCombatFlag as setFlag } from "./action-context";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHitEpilogue,
  gainManaWithCombatText,
} from "./player-rewards";
import { applyCrowdControlTriggerBonuses } from "./bonus-effects";
import { tryTriggerEnemyCc } from "./status-cc";
import { resolveStunTrigger } from "./status-stun-resolve";
import { applyPoisonDamageArmorRider, getEnemyDamageMultiplier } from "./status-helpers";
import { getBattleRng, rollPercent } from "@/lib/rng";
import {
  BLEED_STATUS_MULTIPLIER,
  BATTLE_CONFIG,
  BURN_BLEED_MIRROR_CHANCE_PERCENT,
  FREEZE_THRESHOLD_FRACTION,
  MIN_CC_THRESHOLD_FRACTION,
} from "../game-constants";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage, gearFrozenDamageMultiplier } from "./scaled-damage";
import { applyScaledLeechHealing, computeLeechHeal } from "./damage-rider-leech";
import { detonateEnemyStatuses } from "./dot-resolve";
import { mergeCombatText } from "./combat-text-events";
import { halveRounded } from "./amount-helpers";

function removeEnemyArmorWithFeedback(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const nextState = reduceEnemyArmor(state, amount);
  const removed = state.enemyMitigation.armor - nextState.enemyMitigation.armor;
  if (removed > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "armor", amount: removed, impact: false });
  }
  return nextState;
}

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
    const added = nextState.enemyStatuses[mirrorTarget] - state.enemyStatuses[mirrorTarget];
    if (added > 0) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "multiply", stat: mirrorTarget, amount: added });
    }
  }
  if (!alreadyBurningAndBleeding) return nextState;
  const healAmount = Math.max(1, halveRounded(actualDamage));
  return applyScaledLeechHealing(nextState, healAmount, combatTexts);
}

function applyBurnStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = addEnemyStatus(state, "burn", actualDamage);
  if (nextState.talentEffects.burnRemovesEnemyArmor) {
    nextState = removeEnemyArmorWithFeedback(nextState, actualDamage, combatTexts);
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
  nextState = applyPoisonDamageArmorRider(nextState, actualDamage, combatTexts);
  if (
    actualDamage > 0 &&
    nextState.talentEffects.goldOnFirstPoison > 0 &&
    !nextState.flags.goldOnFirstPoisonThisCombat
  ) {
    nextState = setFlag(
      addGoldWithCombatText(nextState, nextState.talentEffects.goldOnFirstPoison, combatTexts),
      "goldOnFirstPoisonThisCombat",
      true,
    );
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
    nextState = removeEnemyArmorWithFeedback(nextState, 1, combatTexts);
  }
  if (damage > 0) {
    const leechChances = [
      state.trinketEffects.parasiticBloomLeechChance,
      state.talentEffects.poisonLeechChance + state.gearEffects.poisonLeechChance,
    ];
    for (const chance of leechChances) {
      if (!rollBattleChance(chance, nextState)) continue;
      nextState = applyScaledLeechHealing(nextState, computeLeechHeal(damage), combatTexts, { afflicted: true });
    }
    if (
      allowPoisonBleedConversion &&
      onPoisonBleedConversion &&
      rollBattleChance(nextState.talentEffects.poisonBleedDamageChance, nextState)
    ) {
      nextState = onPoisonBleedConversion(nextState, damage, combatTexts);
    }
  }
  return nextState;
}

function applyBleedStatusRider(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  cardLeech: boolean,
): BattleState {
  let nextState = addEnemyStatus(state, "bleed", actualDamage * BLEED_STATUS_MULTIPLIER);
  const bleedAmount = nextState.enemyStatuses.bleed - state.enemyStatuses.bleed;
  if (actualDamage > 0 && rollBattleChance(nextState.talentEffects.bleedHalveArmorChance, nextState)) {
    const halved = halveRounded(nextState.enemyMitigation.armor);
    const removed = nextState.enemyMitigation.armor - halved;
    if (removed > 0) nextState = removeEnemyArmorWithFeedback(nextState, removed, combatTexts);
  }
  // Preserve draw order: the leech chance rolls whenever bleed stacked,
  // even when card lifesteal already guarantees the queue.
  const leechRoll = bleedAmount > 0 && rollBattleChance(nextState.talentEffects.bleedLeechChance, nextState);
  if (bleedAmount > 0 && (effect.lifesteal || leechRoll)) {
    nextState = {
      ...nextState,
      pendingBleedLeechHealing: nextState.pendingBleedLeechHealing + bleedAmount,
      pendingCardBleedLeechHealing:
        nextState.pendingCardBleedLeechHealing + (cardLeech && effect.lifesteal ? bleedAmount : 0),
    };
  }
  if (bleedAmount > 0 && actualDamage > 0 && rollBattleChance(nextState.talentEffects.bleedPoisonChance, nextState)) {
    nextState = addEnemyStatus(nextState, "poison", actualDamage);
  }
  nextState = applyGearBurnBleedMirrorLeech(
    nextState,
    actualDamage,
    "burn",
    combatTexts,
    state.enemyStatuses.burn > 0 && state.enemyStatuses.bleed > 0,
  );
  if (bleedAmount > 0 && nextState.trinketEffects.cutpurseGoldOnBleed > 0) {
    nextState = addGoldWithCombatText(nextState, nextState.trinketEffects.cutpurseGoldOnBleed, combatTexts);
  }
  return nextState;
}

function applyStunStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
  fromHolyDamage = false,
): BattleState {
  emitEnemyBuildupImmunity(state, "stun", actualDamage, combatTexts);
  return resolveStunTrigger(addEnemyStatus(state, "stun", actualDamage), combatTexts, preHitHealth, fromHolyDamage);
}

function emitEnemyBuildupImmunity(
  state: BattleState,
  stat: "stun" | "freeze",
  amount: number,
  combatTexts: CombatTextEvent[],
): void {
  if (amount <= 0 || state.enemyHealth <= 0 || state.enemyCC.cooldown <= 0) return;
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "notice",
    stat,
    signal: "immune",
    text: `Immune to ${stat === "stun" ? "Stun" : "Freeze"}`,
  });
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
  if (result.trinketEffects.frozenHeartDamage > 0) {
    const enemyWasAlive = result.enemyHealth > 0;
    const frozenHealth = result.enemyHealth;
    result = dealEnemyScaledDamage(result, result.trinketEffects.frozenHeartDamage, "physical", combatTexts, {
      multiplier: getEnemyDamageMultiplier(result, "physical") * gearFrozenDamageMultiplier(result),
      riders: (damagedState, _damage, texts) => applyHitEpilogue(damagedState, frozenHealth, enemyWasAlive, texts),
    });
  }
  result = applyGearCcPhysicalDamage(result, preHitState.gearEffects.damageOnFreezePhysical, combatTexts);
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
  eligibility: BattleState,
): BattleState {
  emitEnemyBuildupImmunity(state, "freeze", actualDamage, combatTexts);
  let nextState = addEnemyStatus(state, "freeze", actualDamage);
  if (
    nextState.gearEffects.freezeGrantsBlockAndMana > 0 &&
    actualDamage > 0 &&
    eligibility.playerStatuses.block === 0
  ) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", actualDamage, combatTexts, {
      skipFightPacing: true,
    });
  }
  return tryTriggerEnemyFreeze(eligibility, nextState, combatTexts, preHitHealth);
}

function applyPhysicalStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  critical = false,
  forgeBeforeHit = state.playerStatuses.forge,
  forgeTriggers?: Set<string>,
): BattleState {
  let nextState =
    actualDamage > 0 &&
    state.gearEffects.physicalBleedChance > 0 &&
    rollBattleChance(state.gearEffects.physicalBleedChance, state)
      ? addEnemyStatus(state, "bleed", actualDamage)
      : state;
  if (
    actualDamage > 0 &&
    critical &&
    (state.talentEffects.physicalDetonatesBleed || state.gearEffects.physicalCritDetonatesBleed > 0) &&
    nextState.enemyStatuses.bleed > 0
  ) {
    nextState = detonateEnemyStatuses(nextState, ["bleed"], combatTexts);
  }
  if (
    actualDamage > 0 &&
    state.talentEffects.physicalStripArmorByForge &&
    forgeBeforeHit > 0 &&
    !forgeTriggers?.has("sunder")
  ) {
    forgeTriggers?.add("sunder");
    nextState = removeEnemyArmorWithFeedback(nextState, Math.round(forgeBeforeHit * 0.5), combatTexts);
  }
  if (state.talentEffects.physicalStripArmorWhileBlocked && state.playerStatuses.block > 0) {
    nextState = removeEnemyArmorWithFeedback(nextState, 2, combatTexts);
  }
  return nextState;
}

export function applyDamageStatuses(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
  options: {
    cardLeech?: boolean;
    eligibility?: BattleState;
    allowPoisonBleedConversion?: boolean;
    onPoisonBleedConversion?: (state: BattleState, damage: number, combatTexts: CombatTextEvent[]) => BattleState;
    critical?: boolean;
    forgeBeforeHit?: number;
    forgeTriggers?: Set<string> | undefined;
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
      return applyBleedStatusRider(state, effect, actualDamage, combatTexts, options.cardLeech === true);
    case "stun":
      return applyStunStatusRider(state, actualDamage, combatTexts, preHitHealth);
    case "freeze":
      return applyFreezeStatusRider(state, actualDamage, combatTexts, preHitHealth, options.eligibility ?? state);
    case "physical":
      return applyPhysicalStatusRider(
        state,
        actualDamage,
        combatTexts,
        options.critical,
        options.forgeBeforeHit,
        options.forgeTriggers,
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
