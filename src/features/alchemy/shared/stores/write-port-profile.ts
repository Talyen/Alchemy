import { getDifficultyXPMultiplier, type KeywordId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { CompanionId } from "@/lib/game-data";
import { bindDraftAction, type GameplayDraft } from "./run-session-command";
import {
  createGameplayDraftRunActions,
  createGameplayDraftRunProfileActions,
  createGameplayDraftSessionActions,
} from "./gameplay-state-store";
import { rebindLiveRunMeta } from "./run-meta-rebind";

const runActions = (state: GameplayDraft) => createGameplayDraftRunActions(state);
const sessionActions = (state: GameplayDraft) => createGameplayDraftSessionActions(state);
const runProfileActions = (state: GameplayDraft) => createGameplayDraftRunProfileActions(state);

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(draft: GameplayDraft, materials: MaterialInventory): void {
  runProfileActions(draft).addMaterials(materials);
  runActions(draft).addRunMaterialsEarned(materials);
}

export const setMaterials = bindDraftAction((s) => runProfileActions(s).setMaterials);
export const addMaterials = bindDraftAction((s) => runProfileActions(s).addMaterials);

export function constructBuilding(draft: GameplayDraft, id: BuildingId): boolean {
  const ok = runProfileActions(draft).constructBuilding(id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}
export function plantFarm(draft: GameplayDraft, id: FarmId): boolean {
  const ok = runProfileActions(draft).plantFarm(id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}
export function completeResearch(draft: GameplayDraft, id: ResearchId): boolean {
  const ok = runProfileActions(draft).completeResearch(id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}
export function bondCompanion(draft: GameplayDraft, id: CompanionId): boolean {
  const ok = runProfileActions(draft).bondCompanion(id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}
export function unlockTalent(draft: GameplayDraft, keywordId: KeywordId, talentId: string): void {
  runProfileActions(draft).unlockTalent(keywordId, talentId);
  rebindLiveRunMeta(draft);
}
export const resetUnlockedTalents = bindDraftAction((s) => runProfileActions(s).resetUnlockedTalents);

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents(draft: GameplayDraft): void {
  runProfileActions(draft).unlockAllTalents();
  runActions(draft).resetRunXP();
  rebindLiveRunMeta(draft);
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
export function finalizeRunXP(draft: GameplayDraft): void {
  const run = runActions(draft);
  const session = sessionActions(draft);
  const runProfile = runProfileActions(draft);
  const runTalentXP = draft.run.activeRun.runTalentXP;
  if (Object.keys(runTalentXP).length === 0) {
    session.setRunEndTalentXP({});
    return;
  }
  const multiplier = getDifficultyXPMultiplier(draft.run.activeRun.selectedDifficulty);
  session.setRunEndTalentXP(runProfile.mergeRunTalentXPIntoProfile(runTalentXP, multiplier));
  run.resetRunXP();
  rebindLiveRunMeta(draft);
}
