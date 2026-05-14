// Health/damage helpers that were historically co-located with types to keep battle state
// mutation short. Extracted here so types.ts stays pure.
import type { BattleState } from "./types";

export function clampHealth(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta));
}

export function applyPlayerCombatDamage(state: BattleState, damage: number): BattleState {
  if (damage <= 0) return state;
  const nextHealth = clampHealth(state.playerHealth, -damage, state.playerMaxHealth);
  if (nextHealth > 0) return { ...state, playerHealth: nextHealth };
  if (!state.deathsDoorUsed) {
    return { ...state, playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: true, deathsDoorTriggeredTurn: state.turn };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: state.deathsDoorActive };
}

export function applyPlayerHealing(state: BattleState, amount: number): BattleState {
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  return { ...state, playerHealth, deathsDoorActive: playerHealth <= 0 && state.deathsDoorActive };
}

export function isPlayerDefeated(state: Pick<BattleState, "playerHealth" | "deathsDoorActive">): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}
