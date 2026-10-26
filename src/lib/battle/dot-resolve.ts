import { isPlayerDefeated } from "./battle-outcome";
import { hasEncounterBenefit } from "./encounter-trait-state";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { BattleState, CombatTextEvent } from "./types";
import { damageEnemyHealth, type EnemyHitHealth } from "./health-state";
import { setEnemyStatus } from "./status-state";
import {
  decayHalvedStatus,
  decayPoisonStacks,
  decayArmorAfterDamage,
  applyPoisonDamageArmorRider,
  getEnemyDamageMultiplier,
  getBurnBonusToBleedingMultiplier,
  getPoisonBonusAgainstBleeding,
  getPoisonDamageMultiplierAgainstBleeding,
  getBleedLowHealthDamageMultiplier,
} from "./status-helpers";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { payKillPayouts } from "./player-rewards";
import { resolveBleedGoldReward } from "./bonus-effects";
import { mergeCombatText } from "./combat-text-events";
import { payPendingBleedLeech } from "./stun-leech-resolution";
import { applyBleedDamageDraw, applyElementalDamageManaRestore } from "./player-hit-core";
import { gearFrozenDamageMultiplier } from "./scaled-damage";

export type EnemyDotStatus = "burn" | "poison" | "bleed";

export interface EnemyDotPulse {
  status: EnemyDotStatus;
  finalDamage: number;
  nextStacks: number;
}

function pulseHealthDamage(pulses: readonly EnemyDotPulse[], index: number, health: number): number {
  let earlierDamage = 0;
  for (let i = 0; i < index; i++) earlierDamage += pulses[i]!.finalDamage;
  return Math.min(pulses[index]?.finalDamage ?? 0, Math.max(0, health - earlierDamage));
}

export function applyEnemyDotDamage(
  state: BattleState,
  pulses: readonly EnemyDotPulse[],
  combatTexts: CombatTextEvent[],
  applyRiders?: (state: BattleState, hit: EnemyHitHealth) => BattleState,
): BattleState {
  const finalDamage = pulses.reduce((sum, pulse) => sum + pulse.finalDamage, 0);
  const hit = damageEnemyHealth(state, finalDamage);
  const previousHealth = hit.previousHealth;
  const poisonPulse = pulses.find((pulse) => pulse.status === "poison");
  const shredded = poisonPulse
    ? applyPoisonDamageArmorRider(hit.state, poisonPulse.finalDamage, combatTexts)
    : hit.state;
  let nextState = decayArmorAfterDamage(shredded, finalDamage, "enemy", combatTexts);
  // Commit the tick's consumed stacks before rewards can apply fresh statuses.
  for (const pulse of pulses) nextState = setEnemyStatus(nextState, pulse.status, pulse.nextStacks);

  const bleedIndex = pulses.findIndex((pulse) => pulse.status === "bleed");
  const bleedHealthDamage = bleedIndex >= 0 ? pulseHealthDamage(pulses, bleedIndex, previousHealth) : 0;
  if (bleedHealthDamage > 0) {
    nextState = applyBleedDamageDraw(nextState, bleedHealthDamage, combatTexts);
    if (isPlayerDefeated(nextState)) return nextState;
    nextState = resolveBleedGoldReward(nextState, bleedHealthDamage, combatTexts);
  }

  let earlierDamage = 0;
  for (const pulse of pulses) {
    nextState = applyElementalDamageManaRestore(
      nextState,
      pulse.status,
      Math.min(pulse.finalDamage, Math.max(0, previousHealth - earlierDamage)),
      combatTexts,
    );
    earlierDamage += pulse.finalDamage;
  }
  if (applyRiders) nextState = applyRiders(nextState, hit);
  nextState = processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);
  return payKillPayouts(
    nextState,
    hit.enemyWasAlive,
    combatTexts,
    state.enemyStatuses,
    state.playerStatuses.forge >= 5,
  );
}

export function dealEnemyDotTick(
  state: BattleState,
  status: EnemyDotStatus,
  finalDamage: number,
  nextStacks: number,
  combatTexts: CombatTextEvent[],
  applyRiders?: (state: BattleState, hit: EnemyHitHealth) => BattleState,
): BattleState {
  return applyEnemyDotDamage(state, [{ status, finalDamage, nextStacks }], combatTexts, applyRiders);
}

export function projectEnemyDotDamage(
  state: Pick<
    BattleState,
    | "enemyStatuses"
    | "enemyCC"
    | "currentEnemy"
    | "talentEffects"
    | "gearEffects"
    | "encounterBenefits"
    | "playerHealth"
    | "playerMaxHealth"
  >,
  status: EnemyDotStatus,
  mode: "next-tick" | "remaining-ticks" = "next-tick",
): number {
  const amount = state.enemyStatuses[status];
  if (amount <= 0) return 0;
  let finalDamage = 0;
  let stacks = amount;
  const poisoned = state.enemyStatuses.poison > 0;
  const bleedBonus =
    (poisoned ? state.gearEffects.bleedTickBonusVsPoisoned : 0) +
    (state.enemyStatuses.burn > 0 ? state.gearEffects.bleedTickBonusVsBurning : 0);
  const burnBonus = poisoned ? state.gearEffects.burnTickBonusVsPoisoned : 0;
  let bonus = status === "poison" ? getPoisonBonusAgainstBleeding(state) : 0;
  if (status === "bleed") bonus = bleedBonus;
  if (status === "burn") bonus = burnBonus;
  if (status !== "poison" && state.gearEffects.sharedBurnBleedBonuses > 0) bonus = bleedBonus + burnBonus;
  const multiplier =
    getEnemyDamageMultiplier(state, status) *
    (status === "burn" ? getBurnBonusToBleedingMultiplier(state) : 1) *
    gearFrozenDamageMultiplier(state) *
    (status === "bleed" || (status === "burn" && state.gearEffects.sharedBurnBleedBonuses > 0)
      ? getBleedLowHealthDamageMultiplier(state)
      : 1) *
    (status === "bleed" && state.gearEffects.sharedBurnBleedBonuses > 0 ? getBurnBonusToBleedingMultiplier(state) : 1);
  // Natural ticks and detonations share the live multiplication order.
  // Remaining-tick projections freeze these inputs and round every tick.
  const poisonMultiplier = status === "poison" ? getPoisonDamageMultiplierAgainstBleeding(state) : 1;
  const poisonDecayMultiplier =
    status === "poison" && hasEncounterBenefit(state, "venomous") ? LABYRINTH_MODIFIER_CONFIG.half : 1;
  while (stacks > 0) {
    finalDamage += Math.round((stacks + bonus) * multiplier * poisonMultiplier);
    if (mode === "next-tick") break;
    stacks =
      status === "poison"
        ? decayPoisonStacks(stacks, poisonDecayMultiplier)
        : status === "burn" || (status === "bleed" && state.gearEffects.bleedDecaysByHalf > 0)
          ? decayHalvedStatus(stacks)
          : 0;
  }
  return finalDamage;
}

export function detonateEnemyStatuses(
  state: BattleState,
  statuses: ReadonlyArray<"bleed" | "poison" | "burn">,
  combatTexts: CombatTextEvent[],
  mode: "next-tick" | "remaining-ticks" = "next-tick",
  applyPoisonRiders?: (
    state: BattleState,
    damage: number,
    combatTexts: CombatTextEvent[],
    healthDamage: number,
  ) => BattleState,
): BattleState {
  if (state.enemyHealth <= 0) return state;
  const pulses: EnemyDotPulse[] = [];
  for (const status of statuses) {
    const amount = state.enemyStatuses[status];
    if (amount <= 0) continue;
    const finalDamage = projectEnemyDotDamage(state, status, mode);
    pulses.push({
      status,
      finalDamage,
      nextStacks: 0,
    });
  }
  if (pulses.length === 0) return state;

  const previousHealth = state.enemyHealth;
  let reported = false;
  const reportDamage = () => {
    reported = true;
    for (const [index, pulse] of pulses.entries()) {
      if (pulse.finalDamage > 0) {
        const healthLost = pulseHealthDamage(pulses, index, previousHealth);
        mergeCombatText(combatTexts, {
          target: "enemy",
          kind: "damage",
          stat: pulse.status,
          amount: pulse.finalDamage,
          ...(healthLost !== pulse.finalDamage ? { healthLost } : {}),
        });
      }
    }
  };
  const result = applyEnemyDotDamage(state, pulses, combatTexts, (nextState) => {
    reportDamage();
    const poisonPulse = pulses.find((pulse) => pulse.status === "poison");
    if (poisonPulse) {
      // Attribute overkill in pulse order so Poison cannot Leech Health already lost to Bleed.
      const healthDamage = pulseHealthDamage(pulses, pulses.indexOf(poisonPulse), previousHealth);
      if (applyPoisonRiders)
        nextState = applyPoisonRiders(nextState, poisonPulse.finalDamage, combatTexts, healthDamage);
    }
    const bleedPulse = pulses.find((pulse) => pulse.status === "bleed");
    if (!bleedPulse) return nextState;
    return payPendingBleedLeech(
      previousHealth,
      nextState,
      combatTexts,
      state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0,
      pulseHealthDamage(pulses, pulses.indexOf(bleedPulse), previousHealth),
    );
  });
  // A fatal nested draw skips riders, but the already-landed pulses still need feedback.
  if (!reported) reportDamage();
  return result;
}
