import { FIGHT_PACING } from "@/lib/game-constants";

type PacingEnemyType = keyof typeof FIGHT_PACING.clockByEnemyType;

/** Smoothstep used by live fight pacing; keep in sync with `fight-pacing.ts`. */
function smoothstep(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Authored damage after opening-fight clock (full HP, turn 1, no comeback).
 * E2E cannot import `@/lib/battle` (webp); this mirrors `paceCombatMagnitude`.
 */
export function openingPacedDamage(amount: number, enemyType: PacingEnemyType = "normal"): number {
  if (amount <= 0) return amount;
  const config = FIGHT_PACING.clockByEnemyType[enemyType];
  const normalizedTurn = Math.min(1, 1 / config.targetDuration);
  const expectedBurn = FIGHT_PACING.burnFractionAtTarget * smoothstep(normalizedTurn);
  const scheduleGap = expectedBurn;
  if (scheduleGap < FIGHT_PACING.scheduleThreshold) return amount;
  const span = Math.max(0.0001, FIGHT_PACING.gapFullScale);
  const severity = Math.min(1, (scheduleGap - FIGHT_PACING.scheduleThreshold) / span);
  const bonus = FIGHT_PACING.clockMin + (FIGHT_PACING.clockMax - FIGHT_PACING.clockMin) * severity;
  return Math.round(amount * (1 + bonus));
}
