import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { bindDraftAction, type GameplayDraft } from "./run-session-command";
import {
  createGameplayDraftRunActions,
  createGameplayDraftRunProfileActions,
  createGameplayDraftSessionActions,
} from "./gameplay-state-store";

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
export const constructBuilding = bindDraftAction((s) => runProfileActions(s).constructBuilding);
export const plantFarm = bindDraftAction((s) => runProfileActions(s).plantFarm);
export const completeResearch = bindDraftAction((s) => runProfileActions(s).completeResearch);
export const bondCompanion = bindDraftAction((s) => runProfileActions(s).bondCompanion);
export const unlockTalent = bindDraftAction((s) => runProfileActions(s).unlockTalent);
export const resetUnlockedTalents = bindDraftAction((s) => runProfileActions(s).resetUnlockedTalents);

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents(draft: GameplayDraft): void {
  runProfileActions(draft).unlockAllTalents();
  runActions(draft).resetRunXP();
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
}
