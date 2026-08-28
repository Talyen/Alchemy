import {
  MAX_HEALTH_PER_TALENT_POINT,
  MAX_PLAYER_HEALTH,
  XP_BASE_PER_POINT,
  XP_MIN_THRESHOLD,
  XP_ROOT_DIVISOR,
  XP_TRIANGULAR_MULTIPLIER,
} from "@/lib/game-constants";
import type { KeywordId } from "../types";

const TALENT_PROGRESS_CONFIG = {
  MAX_PERCENT: 100,
  PERCENT_MULTIPLIER: 100,
} as const;

export type TalentXP = Partial<Record<KeywordId, number>>;

export function xpForNextPoint(currentPoints: number): number {
  return (currentPoints + 1) * XP_BASE_PER_POINT;
}

export function xpThresholdForPoints(points: number): number {
  return points * (points + 1) * XP_TRIANGULAR_MULTIPLIER;
}

export function computeTalentPoints(xp: number): number {
  if (xp < XP_MIN_THRESHOLD) return 0;
  return Math.floor((-1 + Math.sqrt(1 + XP_ROOT_DIVISOR * xp)) / 2);
}

export function computeTotalTalentPoints(talentXP: TalentXP): number {
  return Object.values(talentXP).reduce((sum, xp) => sum + computeTalentPoints(xp ?? 0), 0);
}

export function computeStartingMaxHealth(talentXP: TalentXP): number {
  return MAX_PLAYER_HEALTH + computeTotalTalentPoints(talentXP) * MAX_HEALTH_PER_TALENT_POINT;
}

export function xpToNextPoint(xp: number): number {
  const currentPoints = computeTalentPoints(xp);
  const nextThreshold = xpThresholdForPoints(currentPoints + 1);
  return Math.max(0, nextThreshold - xp);
}

export function addTalentXP(xp: TalentXP, keywordIds: KeywordId[], amount = 1): TalentXP {
  const next = { ...xp };
  for (const kw of keywordIds) {
    next[kw] = (next[kw] ?? 0) + amount;
  }
  return next;
}

export function computeRunEndTalentXPSnapshot(runTalentXP: TalentXP, multiplier: number): TalentXP {
  const next: TalentXP = {};
  for (const [kw, amount] of Object.entries(runTalentXP)) {
    if (typeof amount === "number") {
      next[kw as KeywordId] = Math.round(amount * multiplier);
    }
  }
  return next;
}

export function mergeRunTalentXPIntoPermanent(runTalentXP: TalentXP, talentXP: TalentXP, multiplier: number): TalentXP {
  const nextTalentXP = { ...talentXP };
  for (const [kw, amount] of Object.entries(runTalentXP)) {
    if (typeof amount === "number") {
      const bonusAmount = Math.round(amount * multiplier);
      nextTalentXP[kw as KeywordId] = (nextTalentXP[kw as KeywordId] ?? 0) + bonusAmount;
    }
  }
  return nextTalentXP;
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
