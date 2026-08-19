/**
 * Hidden fight pacing: losing-side comeback × stall clock. Multiplies authored
 * combat magnitudes before mitigation. Not a winner penalty; Death's Door is separate.
 */
import { FIGHT_PACING } from "../game-constants";
import type { EnemyType } from "@/lib/game-data";
import type { BattleState } from "./types";

export type FightPacingSide = "player" | "enemy";

export interface FightPacingPoolMetrics {
  playerFraction: number;
  enemyFraction: number;
  actualBurnFraction: number;
}

export interface FightPacingClockConfig {
  targetDuration: number;
  maxRounds: number;
}

const SPAN_EPSILON = 0.0001;

export function fightPacingClockConfig(enemyType: EnemyType): FightPacingClockConfig {
  return FIGHT_PACING.clockByEnemyType[enemyType];
}

export function fightPacingPoolMetrics(state: BattleState): FightPacingPoolMetrics {
  const playerMax = Math.max(1, state.playerMaxHealth);
  const playerCurrent = Math.max(0, state.playerHealth);
  const enemyMax = Math.max(1, state.enemyMaxHealth);
  const enemyCurrent = Math.max(0, state.enemyHealth);
  const totalMax = playerMax + enemyMax;
  const totalCurrent = playerCurrent + enemyCurrent;
  return {
    playerFraction: playerCurrent / playerMax,
    enemyFraction: enemyCurrent / enemyMax,
    actualBurnFraction: (totalMax - totalCurrent) / totalMax,
  };
}

function bandedBonus(severity: number, minBonus: number, maxBonus: number): number {
  return minBonus + (maxBonus - minBonus) * Math.min(1, Math.max(0, severity));
}

function smoothstep(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

export function fightPacingComebackMultiplier(side: FightPacingSide, metrics: FightPacingPoolMetrics): number {
  const hpDelta = metrics.playerFraction - metrics.enemyFraction;
  const absDelta = Math.abs(hpDelta);
  if (absDelta < FIGHT_PACING.evenThreshold) return 1;

  const playerLosing = hpDelta < 0;
  const applies = (side === "player" && playerLosing) || (side === "enemy" && !playerLosing);
  if (!applies) return 1;

  const span = Math.max(SPAN_EPSILON, FIGHT_PACING.maxDelta - FIGHT_PACING.evenThreshold);
  const severity = Math.min(1, (absDelta - FIGHT_PACING.evenThreshold) / span);
  return 1 + bandedBonus(severity, FIGHT_PACING.comebackMin, FIGHT_PACING.comebackMax);
}

export function fightPacingScheduleClockBonus(
  metrics: FightPacingPoolMetrics,
  turn: number,
  config: FightPacingClockConfig,
): number {
  const normalizedTurn = turn > 0 ? Math.min(1, turn / config.targetDuration) : 0;
  const expectedBurn = FIGHT_PACING.burnFractionAtTarget * smoothstep(normalizedTurn);
  const scheduleGap = expectedBurn - metrics.actualBurnFraction;
  if (scheduleGap < FIGHT_PACING.scheduleThreshold) return 0;

  const span = Math.max(SPAN_EPSILON, FIGHT_PACING.gapFullScale);
  const severity = Math.min(1, (scheduleGap - FIGHT_PACING.scheduleThreshold) / span);
  return bandedBonus(severity, FIGHT_PACING.clockMin, FIGHT_PACING.clockMax);
}

export function fightPacingTurnBackstopBonus(turn: number, config: FightPacingClockConfig): number {
  const turnOverrun = Math.max(0, turn - config.maxRounds);
  if (turnOverrun <= 0) return 0;
  const severity = smoothstep(Math.min(1, turnOverrun / FIGHT_PACING.backstopSpan));
  return bandedBonus(severity, FIGHT_PACING.clockMin, FIGHT_PACING.clockMax);
}

export function fightPacingClockMultiplier(
  metrics: FightPacingPoolMetrics,
  turn: number,
  enemyType: EnemyType,
): number {
  const config = fightPacingClockConfig(enemyType);
  const scheduleBonus = fightPacingScheduleClockBonus(metrics, turn, config);
  const backstopBonus = fightPacingTurnBackstopBonus(turn, config);
  return 1 + Math.max(scheduleBonus, backstopBonus);
}

export function fightPacingMultiplier(state: BattleState, side: FightPacingSide): number {
  const metrics = fightPacingPoolMetrics(state);
  const enemyType = state.currentEnemy.enemyType;
  return fightPacingClockMultiplier(metrics, state.turn, enemyType) * fightPacingComebackMultiplier(side, metrics);
}

export function paceCombatMagnitude(
  state: BattleState,
  amount: number,
  side: FightPacingSide,
  applyFightPacing = true,
): number {
  if (!applyFightPacing || !state.appliesFightPacing || amount <= 0) return amount;
  const multiplier = fightPacingMultiplier(state, side);
  if (multiplier === 1) return amount;
  return Math.round(amount * multiplier);
}
