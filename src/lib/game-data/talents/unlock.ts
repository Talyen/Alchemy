import { normalizeUnlockedTalents } from "./compute";
import type { KeywordId } from "../types";
import { countImplementedTalents, getAllocatableTalentChoices } from "./choices";
import { computeTalentPoints, type TalentXP } from "./progression";
import { getTalentById } from "./talent-pool-definitions";
import type { UnlockedTalents } from "./types";

export type UnlockTalentFailureReason =
  | "unknown-talent"
  | "keyword-mismatch"
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
  const talent = getTalentById(talentId);
  if (!talent) return { ok: false, reason: "unknown-talent" };
  if (talent.keywordId !== keywordId) return { ok: false, reason: "keyword-mismatch" };

  const unlockedIds = normalizeUnlockedTalents(unlockedTalents)[keywordId] ?? [];
  if (unlockedIds.includes(talentId)) return { ok: false, reason: "already-unlocked" };

  const points = Math.min(computeTalentPoints(talentXP[keywordId] ?? 0), countImplementedTalents(keywordId));
  if (!(points > unlockedIds.length)) return { ok: false, reason: "no-unspent-points" };

  if (!getAllocatableTalentChoices(keywordId, unlockedIds).some((entry) => entry.id === talentId)) {
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
  const normalized = normalizeUnlockedTalents(unlockedTalents);
  const result = canUnlockTalent(keywordId, talentId, talentXP, normalized);
  if (!result.ok) return { unlockedTalents: null, reason: result.reason };

  return {
    unlockedTalents: {
      ...normalized,
      [keywordId]: [...(normalized[keywordId] ?? []), talentId],
    },
  };
}
