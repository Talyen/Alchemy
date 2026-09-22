import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import {
  damageEnemyHealth,
  setEnemyStatus,
  type BattleState,
  type CombatTextEvent,
  type EnemyHitHealth,
} from "./types";
import {
  decayHalvedStatus,
  decayPoisonStacks,
  decayArmorAfterDamage,
  applyPoisonDamageArmorRider,
  getEnemyDamageMultiplier,
  getBurnBonusToBleedingMultiplier,
  getPoisonBonusAgainstBleeding,
  getPoisonDamageMultiplierAgainstBleeding,
} from "./status-helpers";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { mergeCombatText, payKillPayouts } from "./combat-text";
import { payPendingBleedLeech } from "./damage-rider-leech";
import { applyBleedDamageDraw } from "./bleed-reactions";

export type EnemyDotStatus = "burn" | "poison" | "bleed";

export interface EnemyDotPulse {
  status: EnemyDotStatus;
  finalDamage: number;
  nextStacks: number;
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
  let nextState: BattleState = hit.state;

  if (pulses.some((pulse) => pulse.status === "bleed" && pulse.finalDamage > 0)) {
    nextState = applyBleedDamageDraw(nextState, hit.healthDamage);
  }

  for (const pulse of pulses) {
    nextState = setEnemyStatus(nextState, pulse.status, pulse.nextStacks);
  }
  if (applyRiders) nextState = applyRiders(nextState, hit);
  nextState = decayArmorAfterDamage(nextState, finalDamage, "enemy", combatTexts);
  nextState = processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);
  return payKillPayouts(nextState, hit.enemyWasAlive, combatTexts, state.enemyStatuses);
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

export function detonateEnemyStatuses(
  state: BattleState,
  statuses: ReadonlyArray<"bleed" | "poison" | "burn">,
  combatTexts: CombatTextEvent[],
  mode: "next-tick" | "remaining-ticks" = "next-tick",
  applyPoisonRiders?: (state: BattleState, damage: number, combatTexts: CombatTextEvent[]) => BattleState,
): BattleState {
  if (state.enemyHealth <= 0) return state;
  const pulses: EnemyDotPulse[] = [];
  for (const status of statuses) {
    const amount = state.enemyStatuses[status];
    if (amount <= 0) continue;
    let finalDamage = 0;
    let stacks = amount;
    const bonus = status === "poison" ? getPoisonBonusAgainstBleeding(state) : 0;
    const multiplier =
      getEnemyDamageMultiplier(state, status) *
      (status === "burn" || (status === "bleed" && state.gearEffects.sharedBurnBleedBonuses > 0)
        ? getBurnBonusToBleedingMultiplier(state)
        : 1);
    while (stacks > 0) {
      finalDamage += Math.round(
        (stacks + bonus) * multiplier * (status === "poison" ? getPoisonDamageMultiplierAgainstBleeding(state) : 1),
      );
      if (mode === "next-tick") break;
      stacks =
        status === "poison"
          ? decayPoisonStacks(stacks, hasEncounterBenefit(state, "venomous") ? LABYRINTH_MODIFIER_CONFIG.half : 1)
          : status === "burn" || (status === "bleed" && state.gearEffects.bleedDecaysByHalf > 0)
            ? decayHalvedStatus(stacks)
            : 0;
    }
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
      nextState = applyPoisonDamageArmorRider(nextState, poisonPulse.finalDamage);
      if (applyPoisonRiders) nextState = applyPoisonRiders(nextState, poisonPulse.finalDamage, combatTexts);
    }
    const bleedPulse = pulses.find((pulse) => pulse.status === "bleed");
    if (!bleedPulse) return nextState;
    return payPendingBleedLeech(
      previousHealth,
      {
        ...nextState,
        pendingBleedLeechHealing: Math.min(nextState.pendingBleedLeechHealing, bleedPulse.finalDamage),
      },
      combatTexts,
      state.enemyStatuses.poison > 0 || state.enemyStatuses.bleed > 0,
    );
  });
}
