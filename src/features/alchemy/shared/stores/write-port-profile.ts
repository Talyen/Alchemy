import { getDifficultyXPMultiplier, tryUnlockTalent, type KeywordId } from "@/lib/game-data";
import {
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
  talentPool,
  xpThresholdForPoints,
  type TalentXP,
  type UnlockedTalents,
} from "@/lib/game-data";
import type { CompanionId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import type { GameplayDraft } from "./run-session-command";
import { createInitialPermanentFields } from "./run-state-init";
import { createInitialProfileState, type ProfileStateFields } from "./profile-store-types";
import * as homestead from "./homestead-actions";
import { rebindLiveRunMeta } from "./run-meta-rebind";
import { addRunMaterialsEarned, resetRunXP } from "./write-port-run";

// --- Run-earned materials ---

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(draft: GameplayDraft, materials: MaterialInventory): void {
  homestead.addMaterials(draft.runProfile, materials);
  addRunMaterialsEarned(draft, materials);
}

export function setMaterials(draft: GameplayDraft, materials: MaterialInventory): void {
  homestead.setMaterials(draft.runProfile, materials);
}

export function addMaterials(draft: GameplayDraft, materials: MaterialInventory): void {
  homestead.addMaterials(draft.runProfile, materials);
}

// --- Homestead upgrades (recompute live-run manifests after each spend) ---

export function constructBuilding(draft: GameplayDraft, id: BuildingId): boolean {
  const ok = homestead.constructBuilding(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function plantFarm(draft: GameplayDraft, id: FarmId): boolean {
  const ok = homestead.plantFarm(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function completeResearch(draft: GameplayDraft, id: ResearchId): boolean {
  const ok = homestead.completeResearch(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function bondCompanion(draft: GameplayDraft, id: CompanionId): boolean {
  const ok = homestead.bondCompanion(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

// --- Talents ---

export function unlockTalent(draft: GameplayDraft, keywordId: KeywordId, talentId: string): void {
  const result = tryUnlockTalent(keywordId, talentId, draft.runProfile.talentXP, draft.runProfile.unlockedTalents);
  if (result.unlockedTalents) draft.runProfile.unlockedTalents = result.unlockedTalents;
  rebindLiveRunMeta(draft);
}

export function resetUnlockedTalents(draft: GameplayDraft): void {
  draft.runProfile.unlockedTalents = {};
}

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents(draft: GameplayDraft): void {
  if (!import.meta.env.DEV) return;
  const next: UnlockedTalents = {};
  const xp: TalentXP = {};
  for (const talent of talentPool) {
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

/**
 * Merge the finished run's talent XP into permanent progression and return the
 * run-end snapshot for the game-over / victory screens.
 */
function mergeRunTalentXPIntoProfile(draft: GameplayDraft, runTalentXP: TalentXP, multiplier: number): TalentXP {
  const snapshot = computeRunEndTalentXPSnapshot(runTalentXP, multiplier);
  draft.runProfile.talentXP = mergeRunTalentXPIntoPermanent(runTalentXP, draft.runProfile.talentXP, multiplier);
  return snapshot;
}

/** Reset every permanent (profile-lifetime) field to its initial values. */
export function clearPermanentData(draft: GameplayDraft): void {
  Object.assign(draft.runProfile, createInitialPermanentFields());
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
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

// --- Profile (collection/discovery) region ---

/** Set a profile field from a direct value or an updater over the previous value. */
function assignProfileField<K extends keyof ProfileStateFields>(
  draft: GameplayDraft,
  field: K,
  action: ProfileStateFields[K] | ((prev: ProfileStateFields[K]) => ProfileStateFields[K]),
): void {
  draft.profile[field] = typeof action === "function" ? action(draft.profile[field]) : action;
}

export const setDiscoveredCardIds = (
  draft: GameplayDraft,
  action:
    | ProfileStateFields["discoveredCardIds"]
    | ((prev: ProfileStateFields["discoveredCardIds"]) => ProfileStateFields["discoveredCardIds"]),
): void => {
  assignProfileField(draft, "discoveredCardIds", action);
};

export const setEncounteredEnemyIds = (
  draft: GameplayDraft,
  action:
    | ProfileStateFields["encounteredEnemyIds"]
    | ((prev: ProfileStateFields["encounteredEnemyIds"]) => ProfileStateFields["encounteredEnemyIds"]),
): void => {
  assignProfileField(draft, "encounteredEnemyIds", action);
};

export const setDiscoveredTrinketIds = (
  draft: GameplayDraft,
  action:
    | ProfileStateFields["discoveredTrinketIds"]
    | ((prev: ProfileStateFields["discoveredTrinketIds"]) => ProfileStateFields["discoveredTrinketIds"]),
): void => {
  assignProfileField(draft, "discoveredTrinketIds", action);
};

export const setDiscoveredUniqueIds = (
  draft: GameplayDraft,
  action:
    | ProfileStateFields["discoveredUniqueIds"]
    | ((prev: ProfileStateFields["discoveredUniqueIds"]) => ProfileStateFields["discoveredUniqueIds"]),
): void => {
  assignProfileField(draft, "discoveredUniqueIds", action);
};

export const setCompletedDifficulties = (
  draft: GameplayDraft,
  action:
    | ProfileStateFields["completedDifficulties"]
    | ((prev: ProfileStateFields["completedDifficulties"]) => ProfileStateFields["completedDifficulties"]),
): void => {
  assignProfileField(draft, "completedDifficulties", action);
};

export const setFinishedRunCharacters = (
  draft: GameplayDraft,
  action:
    | ProfileStateFields["finishedRunCharacters"]
    | ((prev: ProfileStateFields["finishedRunCharacters"]) => ProfileStateFields["finishedRunCharacters"]),
): void => {
  assignProfileField(draft, "finishedRunCharacters", action);
};

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
