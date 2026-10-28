import { harmfulPlayerStatusIds } from "@/lib/game-data";
import { resolvePlayerHealing } from "./health-state";
import { isPlayerDefeated } from "./battle-outcome";
import { rollBattleChance } from "./chance-roll";
import { applyCardHealing, removeHarmfulPlayerStatuses } from "./status-player";
import { hasEncounterBenefit, hasEnemyTrait } from "./encounter-trait-state";
import type { BattleState, CombatTextEvent } from "./types";
import {
  addGoldWithCombatText,
  applyHitEpilogue,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
} from "./player-rewards";
import { applyPercentBonus, scalePercent } from "./amount-helpers";
import {
  BATTLE_CONFIG,
  HALF_DIVISOR,
  LEECH_HEAL_FRACTION,
  LABYRINTH_MODIFIER_CONFIG,
  MIN_CC_THRESHOLD_FRACTION,
  PERCENT_DENOMINATOR,
  STUN_THRESHOLD_FRACTION,
  UNIQUE_GEAR_COMBAT,
} from "../game-constants";
import { writeCombatFlag, resolveSecondaryAction } from "./action-context";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { tryTriggerEnemyCc } from "./status-cc";
import { setEnemyStatus, addEnemyStatus } from "./status-state";
import { emitEnemyBuildupImmunity } from "./combat-text-events";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyHitHealth, reportEnemyHitDamage } from "./player-hit-core";
import {
  applyLuckyCloverGold,
  applyNatureGoldReward,
  applyNatureManaRefund,
  applyCrowdControlTriggerBonuses,
} from "./bonus-effects";
import { applyGearCcPhysicalDamage, dealEnemyScaledDamage, scaledGearLeechHeal } from "./scaled-damage";
import { decayArmorAfterDamage, getEnemyDamageMultiplier } from "./status-helpers";

export function computeLeechHeal(damageDealt: number): number {
  if (damageDealt <= 0) return 0;
  return Math.round(damageDealt * LEECH_HEAL_FRACTION);
}

function applyDesperateLeechBonus(state: BattleState, amount: number): number {
  return state.playerHealth < state.playerMaxHealth / HALF_DIVISOR
    ? applyPercentBonus(amount, state.talentEffects.leechDesperateMultiplier, PERCENT_DENOMINATOR)
    : amount;
}

function scalePlayerLeechHeal(state: BattleState, amount: number): number {
  return amount * (hasEncounterBenefit(state, "blood-feast") ? LABYRINTH_MODIFIER_CONFIG.double : 1);
}

function leechHealingAmount(
  state: BattleState,
  amount: number,
  afflicted = state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0,
): number {
  const bonus = afflicted ? state.talentEffects.afflictionLeechBonusPercent : 0;
  return (
    applyPercentBonus(amount, bonus, PERCENT_DENOMINATOR) +
    (amount > 0 ? (state.talentEffects.homesteadLeechHealing ?? 0) : 0)
  );
}

export function applyLeechHealing(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
  options: { cardHealing?: boolean; afflicted?: boolean } = {},
): BattleState {
  if (hasEnemyTrait(state, "hollow-frame")) return state;
  const healing = leechHealingAmount(state, amount, options.afflicted);
  return resolveLeechResourceRewards(state, healing, combatTexts, options);
}

/** Shared base scaler: desperate → gear → Deep Siphon → blood-feast. */
function scaleLeechBase(state: BattleState, amount: number): number {
  const base = scaledGearLeechHeal(applyDesperateLeechBonus(state, amount), state.gearEffects);
  return scalePlayerLeechHeal(state, base + state.talentEffects.leechHealingBonus);
}

export function applyScaledLeechHealing(
  state: BattleState,
  rawAmount: number,
  combatTexts: CombatTextEvent[],
  options: { cardHealing?: boolean; afflicted?: boolean } = {},
): BattleState {
  if (rawAmount <= 0) return state;
  return applyLeechHealing(state, scaleLeechBase(state, rawAmount), combatTexts, options);
}

/** Thunderstone is a shallow trinket hit: restore its actual Health damage with ordinary Leech gain riders. */
function applyThunderstoneLeech(state: BattleState, damage: number, texts: CombatTextEvent[]): BattleState {
  return applyScaledLeechHealing(state, computeLeechHeal(damage), texts);
}

/** Amount already includes Leech scaling; all riders use this restoration's own facts. */
function resolveLeechResourceRewards(
  state: BattleState,
  amount: number,
  texts: CombatTextEvent[],
  options: { cardHealing?: boolean } = {},
): BattleState {
  const restoredHealth = resolvePlayerHealing(state, amount).restored;
  const belowHalf = state.playerHealth < state.playerMaxHealth / HALF_DIVISOR;
  const restoredToFull = restoredHealth > 0 && state.playerHealth + restoredHealth >= state.playerMaxHealth;
  let restored =
    options.cardHealing === true
      ? applyCardHealing(state, amount, texts, { skipFightPacing: true, allowOverhealBlock: false })
      : applyHealingWithCombatText(state, amount, texts, { skipFightPacing: true });
  if (restoredHealth > 0) {
    if (state.playerStatuses.thorns === 0 && state.gearEffects.thornsOnLeechWithoutThorns > 0)
      restored = addPlayerStatusWithCombatText(restored, "thorns", state.gearEffects.thornsOnLeechWithoutThorns, texts);
    if (belowHalf && state.gearEffects.stunOnLeechBelowHalfHealth > 0)
      restored = resolveStunFollowUpHit(restored, state.gearEffects.stunOnLeechBelowHalfHealth, texts);
    if (isPlayerDefeated(restored)) return restored;
    if (rollBattleChance(state.gearEffects.leechBlockChance, state))
      restored = addPlayerStatusWithCombatText(restored, "block", restoredHealth, texts, { skipFightPacing: true });
    if (restoredToFull && state.talentEffects.manaOnLeechToFull > 0)
      restored = gainManaWithCombatText(restored, state.talentEffects.manaOnLeechToFull, texts);
    if (rollBattleChance(state.talentEffects.leechGoldChance, state))
      restored = addGoldWithCombatText(restored, restoredHealth, texts);
  }
  if (amount <= 0 || isPlayerDefeated(restored)) return restored;
  return resolveLeechGainRewards(restored, texts);
}

function resolveLeechGainRewards(state: BattleState, texts: CombatTextEvent[]): BattleState {
  let next = state;
  if (
    state.talentEffects.leechCleanseChance > 0 &&
    harmfulPlayerStatusIds.some((status) => state.playerStatuses[status] > 0) &&
    rollBattleChance(state.talentEffects.leechCleanseChance, state)
  )
    next = removeHarmfulPlayerStatuses(next, 1, texts);
  if (rollBattleChance(state.talentEffects.manaOnLeechChance, state)) next = gainManaWithCombatText(next, 1, texts);
  if (rollBattleChance(state.gearEffects.manaOnLeechChance, state)) next = gainManaWithCombatText(next, 1, texts);
  return next;
}

export function applyLeechHitHealing(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  cardHealing = false,
) {
  if (damage <= 0) return state;

  const healAmount = scaleLeechBase(state, computeLeechHeal(damage));
  return healAmount > 0 ? applyLeechHealing(state, healAmount, combatTexts, { cardHealing }) : state;
}

export function applyHolyLifesteal(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  eligibility = state,
) {
  if (
    damage <= 0 ||
    state.talentEffects.holyLifestealPercent <= 0 ||
    eligibility.playerHealth >= eligibility.playerMaxHealth / HALF_DIVISOR
  )
    return state;
  const healAmount = scalePercent(damage, state.talentEffects.holyLifestealPercent);
  if (healAmount <= 0) return state;
  return applyScaledLeechHealing(state, healAmount, combatTexts);
}

export function applyHolyBlockChance(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  return healthDamage > 0 && rollBattleChance(state.talentEffects.holyBlockChance, state)
    ? addPlayerStatusWithCombatText(state, "block", healthDamage, combatTexts, { skipFightPacing: true })
    : state;
}

export function applyHolyTithe(state: BattleState, healthDamage: number, combatTexts: CombatTextEvent[]) {
  return healthDamage > 0 &&
    state.talentEffects.holyGoldChance > 0 &&
    rollBattleChance(state.talentEffects.holyGoldChance, state)
    ? addGoldWithCombatText(state, healthDamage, combatTexts)
    : state;
}

export function payPendingBleedLeech(
  preHitHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
  afflicted = state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0,
  bleedHealthDamage = Math.max(0, preHitHealth - state.enemyHealth),
): BattleState {
  const leechAmount = state.pendingBleedLeechHealing;
  if (leechAmount <= 0) return state;

  let nextState: BattleState = {
    ...state,
    pendingBleedLeechHealing: 0,
    pendingCardBleedLeechHealing: 0,
  };
  const leechPaid = Math.min(leechAmount, bleedHealthDamage);
  if (leechPaid > 0) {
    nextState = applyScaledLeechHealing(nextState, computeLeechHeal(leechPaid), combatTexts, {
      afflicted,
      cardHealing: state.pendingCardBleedLeechHealing > 0,
    });
  }
  return nextState;
}

function applyStunTrinketEffects(state: BattleState, combatTexts?: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.trinketEffects.thunderstoneDamageOnStun > 0) {
    const previousHealth = nextState.enemyHealth;
    const enemyWasAlive = previousHealth > 0;
    nextState = dealEnemyScaledDamage(
      nextState,
      nextState.trinketEffects.thunderstoneDamageOnStun,
      "nature",
      combatTexts ?? [],
      {
        multiplier: getEnemyDamageMultiplier(nextState, "nature"),
        // Capture the hit's Health loss before Leech can trigger more damage;
        // the shared threshold and kill epilogue still closes this packet.
        riders: (damagedState, finalDamage, texts) => {
          const healthDamage = Math.max(0, previousHealth - damagedState.enemyHealth);
          const leeched =
            state.gearEffects.natureLeechVsPoisoned > 0 && state.enemyStatuses.poison > 0
              ? applyThunderstoneLeech(damagedState, healthDamage, texts)
              : damagedState;
          let rewarded = applyNatureManaRefund(leeched, finalDamage, texts);
          rewarded = applyLuckyCloverGold(rewarded, healthDamage, texts);
          rewarded = applyNatureGoldReward(rewarded, healthDamage, texts);
          return applyHitEpilogue(
            rewarded,
            previousHealth,
            enemyWasAlive,
            texts,
            undefined,
            state.playerStatuses.forge >= 5,
          );
        },
      },
    );
  }
  return nextState;
}

export function resolveStunTrigger(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
  fromHolyDamage = false,
  setupHealthDamage = 0,
): BattleState {
  const texts = combatTexts ?? [];
  const triggered = tryTriggerEnemyCc({
    preHitHealth,
    nextState: state,
    stat: "stun",
    setupHealthDamage,
    stackValue: state.enemyStatuses.stun,
    thresholdFraction: Math.max(
      MIN_CC_THRESHOLD_FRACTION,
      STUN_THRESHOLD_FRACTION - state.talentEffects.stunThresholdReduction,
    ),
    ccCooldown: state.enemyCC.cooldown,
    skipDuration: BATTLE_CONFIG.BASE_CC_DURATION + state.talentEffects.stunDurationExtension,
    combatTexts: texts,
  });
  if (!triggered) return state;
  if (triggered.kind === "immune") return triggered.state;
  let next = state.talentEffects.archeryCritOnCrowdControl
    ? writeCombatFlag(triggered.state, "hawkEyeReady", true)
    : triggered.state;
  if (state.gearEffects.retainStunBuildup > 0)
    next = setEnemyStatus(
      next,
      "stun",
      Math.round(state.enemyStatuses.stun * UNIQUE_GEAR_COMBAT.retainedStunMultiplier),
    );
  if (hasEnemyTrait(next, "brawler"))
    next = writeCombatFlag(recordEnemyAbilityActivation(next, "brawler"), "enemyBrawlerDamagePenalty", true);
  const talents = next.talentEffects;
  const gear = next.gearEffects;
  const purge = rollBattleChance(gear.purgeOnStunChance, next);
  next = applyCrowdControlTriggerBonuses(
    next,
    {
      draw: talents.drawOnStun,
      nextCardFree: talents.nextCardFreeOnStun,
      block: next.playerStatuses.block === 0 ? talents.blockOnStun + gear.blockOnStun : 0,
      forge:
        (rollBattleChance(talents.forgeOnStunChance, next) ? talents.forgeOnStun : 0) +
        gear.forgeOnStunChances.reduce((total, chance) => total + Number(rollBattleChance(chance, next)), 0),
      stripArmor: talents.stunStripArmor,
      mana: next.mana === 0 ? talents.manaOnStun + gear.manaOnStun : 0,
    },
    texts,
  );
  if (isPlayerDefeated(next)) return next;
  next = applyGearCcPhysicalDamage(next, next.gearEffects.damageOnStunPhysical, texts);
  next = applyStunTrinketEffects(next, texts);
  if (fromHolyDamage && next.gearEffects.holyStunBuildupGold > 0)
    next = addGoldWithCombatText(next, next.gearEffects.holyStunBuildupGold, texts);
  // Purge rewards can cause more hits; settle them after Stun's own rewards.
  return purge ? writeCombatFlag(next, "pendingDisruptingPurge", true) : next;
}

/** Leech and Stun can trigger one another; keeping both recipes here avoids a module cycle. */
export function resolveStunFollowUpHit(
  state: BattleState,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return resolveSecondaryAction(state, "reward", (current) => {
    if (amount <= 0 || current.enemyHealth <= 0) return current;
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount };
    const { nextState: afterMods, modifiedDamage, critical } = computeCardDamageToEnemy(current, effect);
    const hit = applyHitHealth(afterMods, modifiedDamage, current, critical);
    const decayed = decayArmorAfterDamage(hit.state, modifiedDamage, "enemy", combatTexts);
    emitEnemyBuildupImmunity(decayed, "stun", modifiedDamage, combatTexts);
    const nextState = resolveStunTrigger(
      addEnemyStatus(decayed, "stun", modifiedDamage),
      combatTexts,
      hit.facts.previousHealth,
      false,
      hit.facts.healthDamage,
    );
    reportEnemyHitDamage(hit.facts, "stun", combatTexts);
    return applyHitEpilogue(
      nextState,
      hit.facts.previousHealth,
      hit.facts.enemyWasAlive,
      combatTexts,
      undefined,
      afterMods.playerStatuses.forge >= 5,
    );
  });
}
