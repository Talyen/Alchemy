import type { GameplayDraft } from "./run-session-command";
import { getDifficultyXPMultiplier, isTalentPlaceholder, tryUnlockTalent, type KeywordId } from "@/lib/game-data";
import {
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
  talentPool,
  xpThresholdForPoints,
  type TalentXP,
  type UnlockedTalents,
} from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import { createInitialPermanentFields } from "./run-state-init";
import { createInitialProfileState, type ProfileStateFields } from "./profile-store-types";
import { rebindLiveRunMeta } from "./run-meta-rebind";
import { resetRunXP } from "./write-port-run";
import { createDraftFieldSetter } from "./write-port-run";

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

function mergeRunTalentXPIntoProfile(draft: GameplayDraft, runTalentXP: TalentXP, multiplier: number): TalentXP {
  const snapshot = computeRunEndTalentXPSnapshot(runTalentXP, multiplier);
  draft.runProfile.talentXP = mergeRunTalentXPIntoPermanent(runTalentXP, draft.runProfile.talentXP, multiplier);
  return snapshot;
}

export function clearPermanentData(draft: GameplayDraft): void {
  Object.assign(draft.runProfile, createInitialPermanentFields());
}

export function finalizeRunXP(draft: GameplayDraft): void {
  const runTalentXP = draft.run.activeRun.runTalentXP;
  if (Object.keys(runTalentXP).length === 0) {
    draft.session.runEndTalentXP = {};
    return;
  }
  const multiplier = getDifficultyXPMultiplier(draft.run.activeRun.selectedDifficulty);
  draft.session.runEndTalentXP = mergeRunTalentXPIntoProfile(draft, runTalentXP, multiplier);
  resetRunXP(draft);
  rebindLiveRunMeta(draft);
}

const createProfileFieldSetter = createDraftFieldSetter<ProfileStateFields, GameplayDraft>((draft) => draft.profile);

export const setDiscoveredCardIds = createProfileFieldSetter("discoveredCardIds");
export const setEncounteredEnemyIds = createProfileFieldSetter("encounteredEnemyIds");
export const setDiscoveredTrinketIds = createProfileFieldSetter("discoveredTrinketIds");
export const setDiscoveredUniqueIds = createProfileFieldSetter("discoveredUniqueIds");
export const setCompletedDifficulties = createProfileFieldSetter("completedDifficulties");
export const setFinishedRunCharacters = createProfileFieldSetter("finishedRunCharacters");

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
