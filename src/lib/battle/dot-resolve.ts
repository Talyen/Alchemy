import { clampHealth, setEnemyStatus, type BattleState, type CombatTextEvent } from "./types";
import { payKillPayouts } from "./kill-payouts";
import { decayArmorAfterDamage, getEnemyDamageMultiplier } from "./status-helpers";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-events";
import { mergeCombatText } from "./combat-text";
import { payPendingBleedLeech } from "./damage-rider-leech";

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
  applyRiders?: (state: BattleState) => BattleState,
): BattleState {
  const finalDamage = pulses.reduce((sum, pulse) => sum + pulse.finalDamage, 0);
  const previousHealth = state.enemyHealth;
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };

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

export function detonateEnemyStatuses(
  state: BattleState,
  statuses: ReadonlyArray<"bleed" | "poison">,
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
