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
import { defineDraftSetter } from "./write-field";

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

function defineProfileSetter<K extends keyof ProfileStateFields>(field: K) {
  return defineDraftSetter((draft: GameplayDraft) => draft.profile, field);
}

export const setDiscoveredCardIds = defineProfileSetter("discoveredCardIds");

export const setEncounteredEnemyIds = defineProfileSetter("encounteredEnemyIds");

export const setDiscoveredTrinketIds = defineProfileSetter("discoveredTrinketIds");

export const setDiscoveredUniqueIds = defineProfileSetter("discoveredUniqueIds");

export const setCompletedDifficulties = defineProfileSetter("completedDifficulties");

export const setFinishedRunCharacters = defineProfileSetter("finishedRunCharacters");

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
