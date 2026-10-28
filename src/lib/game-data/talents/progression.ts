import {
  MAX_HEALTH_PER_TALENT_POINT,
  MAX_PLAYER_HEALTH,
  XP_EARLY_POINT_DISCOUNT,
  XP_MIN_THRESHOLD,
  XP_ROOT_DIVISOR,
  XP_TRIANGULAR_MULTIPLIER,
} from "@/lib/game-constants";
import type { KeywordId } from "../types";
import { TALENT_TREE_KEYWORD_IDS } from "./xp-keywords";

export type TalentXP = Partial<Record<KeywordId, number>>;

export function xpThresholdForPoints(points: number): number {
  return points * (points + 1) * XP_TRIANGULAR_MULTIPLIER - Math.min(points, 2) * XP_EARLY_POINT_DISCOUNT;
}

export function computeTalentPoints(xp: number): number {
  if (!Number.isFinite(xp) || xp > Number.MAX_SAFE_INTEGER || xp < XP_MIN_THRESHOLD) return 0;
  // Restore the two early discounts when inverting the later triangular thresholds.
  const points = Math.floor((-1 + Math.sqrt(1 + XP_ROOT_DIVISOR * (xp + 2 * XP_EARLY_POINT_DISCOUNT))) / 2);
  // The square root can round up one point before large, still-valid thresholds.
  return xp < xpThresholdForPoints(points) ? points - 1 : points;
}

function computeTotalTalentPoints(talentXP: TalentXP): number {
  return Object.entries(talentXP).reduce(
    (sum, [keyword, xp]) =>
      TALENT_TREE_KEYWORD_IDS.has(keyword as KeywordId) ? sum + computeTalentPoints(xp ?? 0) : sum,
    0,
  );
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
    next[kw] = Math.min(Number.MAX_SAFE_INTEGER, (next[kw] ?? 0) + amount);
  }
  return next;
}

export function computeRunEndTalentXPSnapshot(runTalentXP: TalentXP, multiplier: number): TalentXP {
  const next: TalentXP = {};
  for (const [kw, amount] of Object.entries(runTalentXP)) {
    if (typeof amount === "number") {
      next[kw as KeywordId] = Math.min(Number.MAX_SAFE_INTEGER, Math.round(amount * multiplier));
    }
  }
  return next;
}

export function mergeTalentXPAwards(talentXP: TalentXP, awards: TalentXP): TalentXP {
  const nextTalentXP = { ...talentXP };
  for (const [kw, bonus] of Object.entries(awards)) {
    if (bonus === undefined) continue;
    const keyword = kw as KeywordId;
    nextTalentXP[keyword] = Math.min(Number.MAX_SAFE_INTEGER, (nextTalentXP[keyword] ?? 0) + bonus);
  }
  return nextTalentXP;
}

export interface TalentKeywordProgress {
  totalXP: number;
  points: number;
  displayLevel: number;
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
  const nextThreshold = xpThresholdForPoints(points + 1);
  const xpForNext = nextThreshold - xpThresholdForPoints(points);
  const xpRemaining = Math.max(0, nextThreshold - totalXP);
  const progressPercent = Math.min(100, Math.round(((xpForNext - xpRemaining) / xpForNext) * 100));
  const unspentPoints = Math.max(0, Math.min(points, totalTalents ?? points) - unlockedCount);
  return {
    totalXP,
    points,
    displayLevel: points + 1,
    xpForNext,
    xpRemaining,
    progressPercent,
    spentPoints: unlockedCount,
    unspentPoints,
    hasUnspent: unspentPoints > 0,
  };
}
