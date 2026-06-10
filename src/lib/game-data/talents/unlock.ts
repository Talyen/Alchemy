/**
 * Talent unlock validation — authoritative rules for spending keyword points.
 * Depends on: talent pool, progression math, and choice ordering helpers.
 */
import { TALENT_CHOICES_OFFERED } from "@/lib/game-constants";
import type { KeywordId } from "../types";
import { getNextTalentChoices } from "./choices";
import { talentPool } from "./pool";
import { getTalentKeywordProgress, type TalentXP } from "./progression";
import type { UnlockedTalents } from "./types";
import { countImplementedTalents } from "./choices";

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

  const choices = getNextTalentChoices(keywordId, unlockedIds, TALENT_CHOICES_OFFERED);
  if (!choices.some((choice) => choice.id === talentId)) {
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
