import type { CollectionTab } from "@/features/alchemy/shared/types";
import type { KeywordId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import {
  computeRunEndTalentXPSnapshot,
  getDifficultyXPMultiplier,
  isTalentPlaceholder,
  mergeRunTalentXPIntoPermanent,
  talentPool,
  tryUnlockTalent,
  xpThresholdForPoints,
} from "@/lib/game-data";
import type { GameplayDraft } from "../run-session-command";
import { createInitialProfileState, type ProfileStateFields } from "../profile-store-types";
import { createInitialPermanentFields } from "../run-state-init";
import { rebindLiveRunMeta } from "./live-meta";
import { resetRunXP } from "./run-progress";
import { type FieldUpdate, setField } from "./write-field";

// ── Meta (talents, XP merge, collection) ─────────────────────────────────────

export function unlockTalent(draft: GameplayDraft, keywordId: KeywordId, talentId: string): void {
  const result = tryUnlockTalent(keywordId, talentId, draft.runProfile.talentXP, draft.runProfile.unlockedTalents);
  if (result.unlockedTalents) draft.runProfile.unlockedTalents = result.unlockedTalents;
  rebindLiveRunMeta(draft);
}

export function resetUnlockedTalents(draft: GameplayDraft): void {
  draft.runProfile.unlockedTalents = {};
}

export function unlockAllTalents(draft: GameplayDraft): void {
  if (!import.meta.env.DEV) return;
  const next: UnlockedTalents = {};
  const xp: TalentXP = {};
  for (const talent of talentPool) {
    if (isTalentPlaceholder(talent)) continue;
    next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
  }
  for (const [keyword, ids] of Object.entries(next)) {
    xp[keyword as KeywordId] = xpThresholdForPoints(ids.length);
  }
  draft.runProfile.unlockedTalents = next;
  draft.runProfile.talentXP = xp;
  resetRunXP(draft);
  rebindLiveRunMeta(draft);
}

export function applyTalentState(draft: GameplayDraft, talentXP: TalentXP, unlockedTalents: UnlockedTalents): void {
  draft.runProfile.talentXP = talentXP;
  draft.runProfile.unlockedTalents = unlockedTalents;
}

export function clearPermanentData(draft: GameplayDraft): void {
  Object.assign(draft.runProfile, createInitialPermanentFields());
}

// Run talent XP merges into the permanent profile exactly once at run end;
// `finalizeRunXP` also records the merged snapshot for the run recap screen.
export function finalizeRunXP(draft: GameplayDraft): void {
  const runTalentXP = draft.run.activeRun.runTalentXP;
  if (Object.keys(runTalentXP).length === 0) {
    draft.session.runEndTalentXP = {};
    return;
  }
  const multiplier = getDifficultyXPMultiplier(draft.run.activeRun.selectedDifficulty);
  draft.session.runEndTalentXP = computeRunEndTalentXPSnapshot(runTalentXP, multiplier);
  draft.runProfile.talentXP = mergeRunTalentXPIntoPermanent(runTalentXP, draft.runProfile.talentXP, multiplier);
  resetRunXP(draft);
  rebindLiveRunMeta(draft);
}

function setProfileField<K extends keyof ProfileStateFields>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<ProfileStateFields[K]>,
): void {
  setField(draft.profile, field, action);
}

export function setDiscoveredCardIds(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["discoveredCardIds"]>,
): void {
  setProfileField(draft, "discoveredCardIds", action);
}

export function setEncounteredEnemyIds(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["encounteredEnemyIds"]>,
): void {
  setProfileField(draft, "encounteredEnemyIds", action);
}

export function setDiscoveredTrinketIds(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["discoveredTrinketIds"]>,
): void {
  setProfileField(draft, "discoveredTrinketIds", action);
}

export function setDiscoveredUniqueIds(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["discoveredUniqueIds"]>,
): void {
  setProfileField(draft, "discoveredUniqueIds", action);
}

export function setCompletedDifficulties(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["completedDifficulties"]>,
): void {
  setProfileField(draft, "completedDifficulties", action);
}

export function setFinishedRunCharacters(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["finishedRunCharacters"]>,
): void {
  setProfileField(draft, "finishedRunCharacters", action);
}

export function setCollectionPage(draft: GameplayDraft, tab: CollectionTab, page: number): void {
  draft.profile.collectionPages[tab] = Math.max(0, page);
}

export function handleCollectionTabChange(draft: GameplayDraft, tab: CollectionTab): void {
  draft.profile.collectionTab = tab;
  draft.profile.collectionPages[tab] ??= 0;
}

export function resetToDefaults(draft: GameplayDraft): void {
  Object.assign(draft.profile, createInitialProfileState());
}
