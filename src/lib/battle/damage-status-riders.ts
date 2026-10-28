import { BATTLE_CONFIG, MIN_CC_THRESHOLD_FRACTION, FREEZE_THRESHOLD_FRACTION } from "../game-constants";
import { writeCombatFlag } from "./action-context";
import { tryTriggerEnemyCc } from "./status-cc";
import { halveRounded } from "./amount-helpers";
import { rollBattleChance } from "./chance-roll";
import { resolveBleedGoldReward, applyCrowdControlTriggerBonuses } from "./bonus-effects";
import type { BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { addEnemyStatus } from "./status-state";
import { reduceEnemyArmor } from "./enemy-mitigation-state";
import { addPlayerStatusWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { resolveStunTrigger, applyScaledLeechHealing, computeLeechHeal } from "./stun-leech-resolution";
import { applyPoisonDamageArmorRider } from "./status-helpers";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { BLEED_STATUS_MULTIPLIER, BURN_BLEED_MIRROR_CHANCE_PERCENT, HALF_DIVISOR } from "../game-constants";
import { applyGearCcPhysicalDamage } from "./scaled-damage";
import { detonateEnemyStatuses } from "./dot-resolve";
import { emitEnemyBuildupImmunity, emitDamageText, emitMultiplyText } from "./combat-text-events";

function removeEnemyArmorWithFeedback(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const nextState = reduceEnemyArmor(state, amount);
  const removed = state.enemyMitigation.armor - nextState.enemyMitigation.armor;
  if (removed > 0) {
    emitDamageText(combatTexts, "enemy", "armor", removed, { impact: false });
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
    nextState = addEnemyStatus(nextState, mirrorTarget, actualDamage, { combatTexts });
    const added = nextState.enemyStatuses[mirrorTarget] - state.enemyStatuses[mirrorTarget];
    if (added > 0) {
      emitMultiplyText(combatTexts, "enemy", mirrorTarget, added);
    }
  }
  const healAmount =
    state.gearEffects.burnBleedMirrorAndLeech > 0 && actualDamage > 0 && alreadyBurningAndBleeding
      ? Math.max(1, Math.round(actualDamage / HALF_DIVISOR))
      : 0;
  return healAmount > 0 ? applyScaledLeechHealing(nextState, healAmount, combatTexts) : nextState;
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
  let nextState = addEnemyStatus(state, "poison", actualDamage, { combatTexts });
  nextState = applyPoisonDamageArmorRider(nextState, actualDamage, combatTexts);
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

  if (damage > 0) {
    for (const chance of [
      nextState.trinketEffects.parasiticBloomLeechChance,
      nextState.talentEffects.poisonLeechChance + nextState.gearEffects.poisonLeechChance,
    ]) {
      if (rollBattleChance(chance, nextState))
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
  healthDamage: number,
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
  nextState = applyGearBurnBleedMirrorLeech(
    nextState,
    actualDamage,
    "burn",
    combatTexts,
    state.enemyStatuses.burn > 0 && state.enemyStatuses.bleed > 0,
  );
  return resolveBleedGoldReward(nextState, healthDamage, combatTexts);
}

function applyStunStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
  fromHolyDamage = false,
): BattleState {
  if (actualDamage <= 0) return state;
  emitEnemyBuildupImmunity(state, "stun", actualDamage, combatTexts);
  return resolveStunTrigger(
    addEnemyStatus(state, "stun", actualDamage),
    combatTexts,
    preHitHealth,
    fromHolyDamage,
    Math.min(actualDamage, preHitHealth),
  );
}

export function tryTriggerEnemyFreeze(
  eligibility: BattleState,
  state: BattleState,
  texts: CombatTextEvent[],
  preHitHealth = eligibility.enemyHealth,
  setupHealthDamage = 0,
): BattleState {
  const triggered = tryTriggerEnemyCc({
    preHitHealth,
    nextState: state,
    stat: "freeze",
    setupHealthDamage,
    stackValue: state.enemyStatuses.freeze,
    thresholdFraction: Math.max(
      MIN_CC_THRESHOLD_FRACTION,
      FREEZE_THRESHOLD_FRACTION - eligibility.talentEffects.freezeThresholdReduction,
    ),
    ccCooldown: state.enemyCC.cooldown,
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + state.trinketEffects.freezeDurationExtension,
    combatTexts: texts,
  });
  if (!triggered) return state;
  if (triggered.kind === "immune") return triggered.state;
  let next = eligibility.talentEffects.archeryCritOnCrowdControl
    ? writeCombatFlag(triggered.state, "hawkEyeReady", true)
    : triggered.state;
  next = applyGearCcPhysicalDamage(next, next.trinketEffects.frozenHeartDamage, texts);
  next = applyGearCcPhysicalDamage(next, eligibility.gearEffects.damageOnFreezePhysical, texts);
  next = applyCrowdControlTriggerBonuses(
    next,
    {
      block: next.talentEffects.blockOnFreeze,
      stripArmor: next.talentEffects.freezeStripArmor,
      stripBlock: next.talentEffects.freezeStripBlock,
    },
    texts,
  );
  return next.gearEffects.freezeGrantsBlockAndMana > 0 && eligibility.mana === 0
    ? gainManaWithCombatText(next, halveRounded(next.playerStatuses.block), texts, { skipFightPacing: true })
    : next;
}

function applyFreezeStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  preHitHealth: number,
  eligibility: BattleState,
): BattleState {
  if (actualDamage <= 0) return state;
  emitEnemyBuildupImmunity(state, "freeze", actualDamage, combatTexts);
  let nextState = addEnemyStatus(state, "freeze", actualDamage);
  if (nextState.gearEffects.freezeGrantsBlockAndMana > 0 && eligibility.playerStatuses.block === 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", actualDamage, combatTexts, {
      skipFightPacing: true,
    });
  }
  return tryTriggerEnemyFreeze(eligibility, nextState, combatTexts, preHitHealth, Math.min(actualDamage, preHitHealth));
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
  const bleedAdded = nextState.enemyStatuses.bleed - state.enemyStatuses.bleed;
  if (bleedAdded > 0) {
    emitMultiplyText(combatTexts, "enemy", "bleed", bleedAdded);
  }
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
      return applyBleedStatusRider(
        state,
        effect,
        actualDamage,
        combatTexts,
        options.cardLeech === true,
        Math.min(actualDamage, Math.max(0, preHitHealth)),
      );
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
