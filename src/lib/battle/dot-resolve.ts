/**
 * Shared enemy DoT tail: one health transition for ticks and detonates so
 * kill payouts, armor decay, and Divine Aegis cannot drift across sources.
 */
import { clampHealth, setEnemyStatus, type BattleState, type CombatTextEvent } from "./types";
import { payKillPayouts } from "./kill-payouts";
import { decayArmorAfterDamage, getEnemyDamageMultiplier } from "./status-helpers";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-events";
import { mergeCombatText } from "./combat-text";
import { payPendingBleedLeech } from "./damage-rider-leech";

export type EnemyDotStatus = "burn" | "poison" | "bleed";

export type EnemyDotPulse = {
  status: EnemyDotStatus;
  finalDamage: number;
  nextStacks: number;
};

/** Clamp health once, pay lethality, apply stack updates, riders, armor decay, trait threshold. */
export function applyEnemyDotDamage(
  state: BattleState,
  pulses: readonly EnemyDotPulse[],
  combatTexts: CombatTextEvent[],
  applyRiders?: (state: BattleState) => BattleState,
): BattleState {
  const finalDamage = pulses.reduce((sum, pulse) => sum + pulse.finalDamage, 0);
  const previousHealth = state.enemyHealth;
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };
  // Paid before stack decay so a lethal burn tick still counts as "defeated
  // while burning" for healOnBurnEnemyDefeated.
  nextState = payKillPayouts(nextState, previousHealth > 0, combatTexts);
  for (const pulse of pulses) {
    nextState = setEnemyStatus(nextState, pulse.status, pulse.nextStacks);
  }
  if (applyRiders) nextState = applyRiders(nextState);
  nextState = decayArmorAfterDamage(nextState, finalDamage, "enemy", combatTexts);
  return processEncounterTraitHealthThreshold(previousHealth, nextState, combatTexts);
}

export function dealEnemyDotTick(
  state: BattleState,
  status: EnemyDotStatus,
  finalDamage: number,
  nextStacks: number,
  combatTexts: CombatTextEvent[],
  applyRiders?: (state: BattleState) => BattleState,
): BattleState {
  return applyEnemyDotDamage(state, [{ status, finalDamage, nextStacks }], combatTexts, applyRiders);
}

/**
 * Burst remaining bleed/poison in one health transition (physical talent / archery gear).
 * Combat text and bleed-leech payout live here so both detonate callers stay aligned.
 */
export function detonateEnemyStatuses(
  state: BattleState,
  statuses: readonly ("bleed" | "poison")[],
  combatTexts: CombatTextEvent[],
): BattleState {
  const pulses: EnemyDotPulse[] = [];
  for (const status of statuses) {
    const amount = state.enemyStatuses[status];
    if (amount <= 0) continue;
    pulses.push({
      status,
      finalDamage: Math.round(amount * getEnemyDamageMultiplier(state, status)),
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
    return payPendingBleedLeech(previousHealth, nextState, combatTexts);
  });
}
