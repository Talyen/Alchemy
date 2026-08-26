/**
 * Talent unlock validation — authoritative rules for spending keyword points.
 */
import type { KeywordId } from "../types";
import { countImplementedTalents, getTalentRowIndex, getTalentsForKeyword, isTalentRowUnlocked } from "./choices";
import { talentPool } from "./pool";
import { getTalentKeywordProgress, type TalentXP } from "./progression";
import type { UnlockedTalents } from "./types";

export type UnlockTalentFailureReason =
  | "unknown-talent"
  | "keyword-mismatch"
  | "not-implemented"
  | "already-unlocked"
  | "no-unspent-points"
  | "not-eligible-choice";

export type UnlockTalentResult = { ok: true } | { ok: false; reason: UnlockTalentFailureReason };

export function canUnlockTalent(
  keywordId: KeywordId,
  talentId: string,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): UnlockTalentResult {
  const talent = talentPool.find((entry) => entry.id === talentId);
  if (!talent) return { ok: false, reason: "unknown-talent" };
  if (talent.keywordId !== keywordId) return { ok: false, reason: "keyword-mismatch" };
  if (talent.isPlaceholder) return { ok: false, reason: "not-implemented" };

  const unlockedIds = unlockedTalents[keywordId] ?? [];
  if (unlockedIds.includes(talentId)) return { ok: false, reason: "already-unlocked" };

  const progress = getTalentKeywordProgress(
    talentXP[keywordId] ?? 0,
    unlockedIds.length,
    countImplementedTalents(keywordId),
  );
  if (!progress.hasUnspent) return { ok: false, reason: "no-unspent-points" };

  const index = getTalentsForKeyword(keywordId).findIndex((entry) => entry.id === talentId);
  if (index < 0 || !isTalentRowUnlocked(keywordId, unlockedIds, getTalentRowIndex(index))) {
    return { ok: false, reason: "not-eligible-choice" };
  }

  return { ok: true };
}

export function tryUnlockTalent(
  keywordId: KeywordId,
  talentId: string,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): { unlockedTalents: UnlockedTalents } | { unlockedTalents: null; reason: UnlockTalentFailureReason } {
  const result = canUnlockTalent(keywordId, talentId, talentXP, unlockedTalents);
  if (!result.ok) return { unlockedTalents: null, reason: result.reason };

  return {
    unlockedTalents: {
      ...unlockedTalents,
      [keywordId]: [...(unlockedTalents[keywordId] ?? []), talentId],
    },
  };
}
