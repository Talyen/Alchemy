/**
 * Mathematical formulas and mapping functions for keyword Talent XP progression.
 * Depends on: src/lib/game-constants.ts and src/lib/game-data/types.ts.
 * Depended on by: Talents UI screen, homestead systems, and the player save loaders.
 */
import type { KeywordId } from "@/lib/game-data/types";
import { XP_BASE_PER_POINT, XP_MIN_THRESHOLD, XP_ROOT_DIVISOR, XP_TRIANGULAR_MULTIPLIER } from "./game-constants";

export const TALENT_PROGRESS_CONFIG = {
  MAX_PERCENT: 100,
  PERCENT_MULTIPLIER: 100,
} as const;

// XP is tracked per keyword (damage type). Each keyword has its own progress bar
// toward the next talent point. XP is awarded when a card matching that keyword is played.
export type TalentXP = Partial<Record<KeywordId, number>>;

// XP-to-next-point uses a triangular number sequence: point 0→1 needs 10 XP,
// 1→2 needs 20 XP, 2→3 needs 30 XP, etc. This makes early points cheap and
// later points progressively more expensive.
export function xpForNextPoint(currentPoints: number): number {
  return (currentPoints + 1) * XP_BASE_PER_POINT;
}

// Cumulative XP needed to reach a given number of points.
// Triangular sum formula: n(n+1)/2 * 10 -> points * (points + 1) * 5
// (Assuming XP_TRIANGULAR_MULTIPLIER is 5, representing half of XP_BASE_PER_POINT).
// This is the mathematical inverse of computeTalentPoints.
// Game-state assumption: points is a non-negative integer.
export function xpThresholdForPoints(points: number): number {
  return points * (points + 1) * XP_TRIANGULAR_MULTIPLIER;
}

// Inverse of xpThresholdForPoints: given total XP, compute how many points earned.
// Derived algebraically from: XP >= points * (points + 1) * XP_TRIANGULAR_MULTIPLIER
// Let T = XP_TRIANGULAR_MULTIPLIER. Solving points^2 + points - XP/T = 0
// Using the quadratic formula: points = (-b + sqrt(b^2 - 4ac)) / (2a)
// where a = 1, b = 1, c = -XP/T.
// points = (-1 + sqrt(1 + 4 * XP / T)) / 2
// Letting XP_ROOT_DIVISOR = 4 / T = 4 / 5 = 0.8, this simplifies to:
// points = (-1 + sqrt(1 + XP_ROOT_DIVISOR * xp)) / 2
// Taking the floor gives the largest integer points tier reached.
export function computeTalentPoints(xp: number): number {
  if (xp < XP_MIN_THRESHOLD) return 0;
  return Math.floor((-1 + Math.sqrt(1 + XP_ROOT_DIVISOR * xp)) / 2);
}

// XP remaining until the next talent point. Used for the progress bar display.
export function xpToNextPoint(xp: number): number {
  const currentPoints = computeTalentPoints(xp);
  const nextThreshold = xpThresholdForPoints(currentPoints + 1);
  return Math.max(0, nextThreshold - xp);
}

// Adds XP to one or more keywords. Used both for permanent (cross-run) XP and
// run-specific XP tracking. Returns a new object to maintain immutability.
export function addTalentXP(xp: TalentXP, keywordIds: KeywordId[], amount = 1): TalentXP {
  const next = { ...xp };
  for (const kw of keywordIds) {
    next[kw] = (next[kw] ?? 0) + amount;
  }
  return next;
}

export interface TalentKeywordProgress {
  totalXP: number;
  points: number;
  xpForNext: number;
  xpRemaining: number;
  progressPercent: number;
  spentPoints: number;
  unspentPoints: number;
  hasUnspent: boolean;
}

export function getTalentKeywordProgress(
  totalXP: number,
  unlockedCount: number,
  totalTalents?: number,
): TalentKeywordProgress {
  const points = computeTalentPoints(totalXP);
  const xpForNext = xpForNextPoint(points);
  const xpRemaining = xpToNextPoint(totalXP);
  const progressPercent = Math.min(
    TALENT_PROGRESS_CONFIG.MAX_PERCENT,
    Math.round(((xpForNext - xpRemaining) / xpForNext) * TALENT_PROGRESS_CONFIG.PERCENT_MULTIPLIER),
  );
  const spentPoints = unlockedCount;
  const unspentPoints = Math.max(0, points - spentPoints);
  const cappedUnspent =
    totalTalents !== undefined ? Math.max(0, Math.min(unspentPoints, totalTalents - unlockedCount)) : unspentPoints;
  return {
    totalXP,
    points,
    xpForNext,
    xpRemaining,
    progressPercent,
    spentPoints,
    unspentPoints: cappedUnspent,
    hasUnspent: cappedUnspent > 0,
  };
}
