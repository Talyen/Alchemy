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
import { addGoldWithCombatText, payKillPayouts } from "./player-rewards";
import { mergeCombatText } from "./combat-text-events";
import { payPendingBleedLeech } from "./damage-rider-leech";
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
    nextState = addGoldWithCombatText(nextState, state.trinketEffects.cutpurseGoldOnBleed, combatTexts);
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
  const bonus = status === "poison" ? getPoisonBonusAgainstBleeding(state) : 0;
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
  return applyEnemyDotDamage(state, pulses, combatTexts, (nextState) => {
    for (const pulse of pulses) {
      if (pulse.finalDamage > 0) {
        mergeCombatText(combatTexts, {
          target: "enemy",
          kind: "damage",
          stat: pulse.status,
          amount: pulse.finalDamage,
        });
      }
    }
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
}
