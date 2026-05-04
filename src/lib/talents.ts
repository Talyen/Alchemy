import type { BattleCard, KeywordId } from "@/lib/game-data";
import { XP_BASE_PER_POINT, XP_MIN_THRESHOLD, XP_ROOT_DIVISOR, XP_TRIANGULAR_MULTIPLIER } from "./game-constants";

// XP is tracked per keyword (damage type). Each keyword has its own progress bar
// toward the next talent point. XP is awarded when a card matching that keyword is played.
export type TalentXP = Partial<Record<KeywordId, number>>;

// XP-to-next-point uses a triangular number sequence: point 0→1 needs 10 XP,
// 1→2 needs 20 XP, 2→3 needs 30 XP, etc. This makes early points cheap and
// later points progressively more expensive, giving fast early progression.
// Formula: (currentPoints + 1) * 10
export function xpForNextPoint(currentPoints: number): number {
  return (currentPoints + 1) * XP_BASE_PER_POINT;
}

// Cumulative XP needed to reach a given number of points.
// Triangular sum formula: n(n+1)/2 * 5 -> points * (points + 1) * 5
// This is the inverse of computeTalentPoints.
export function xpThresholdForPoints(points: number): number {
  return points * (points + 1) * XP_TRIANGULAR_MULTIPLIER;
}

// Inverse of xpThresholdForPoints: given total XP, compute how many points earned.
// Uses the quadratic formula: floor((-1 + sqrt(1 + 0.8 * XP)) / 2)
// The sqrt/division approach avoids iteration, which matters because this is
// called on every render of the talents screen.
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

// Maps a card's effects to the keyword IDs that should receive XP.
// A single card can grant XP to multiple keywords (e.g. a physical burn card).
// The keyword → XP mapping is how the talent system incentivizes certain play styles.
export function extractCardKeywords(card: BattleCard): KeywordId[] {
  const keywords = new Set<KeywordId>();
  if (card.consume) keywords.add("consume");
  for (const effect of card.effects) {
    switch (effect.kind) {
      case "damage":
        keywords.add(effect.damageType as KeywordId);
        if (effect.lifesteal) keywords.add("leech");
        break;
      case "player-status":
        keywords.add(effect.status as KeywordId);
        break;
      case "heal":
        keywords.add("health");
        break;
      case "wish":
        keywords.add("wish");
        break;
      case "gain-gold":
        keywords.add("gold");
        break;
      case "restore-mana":
      case "lose-mana":
      case "gain-max-mana":
      case "lose-max-mana":
        keywords.add("mana");
        break;
      case "remove-ailment":
        keywords.add("ailment");
        break;
    }
  }
  return Array.from(keywords);
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
