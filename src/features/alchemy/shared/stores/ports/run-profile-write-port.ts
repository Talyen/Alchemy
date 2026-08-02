// Permanent-profile write port — the only place run-loop code mutates meta progression.
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { CompanionId, KeywordId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import { dispatchRunSessionCommand } from "../run-session-command";
import { readGameplayState } from "../gameplay-state-store";

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(materials: MaterialInventory) {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    session.runProfileActions.addMaterials(materials);
    session.runActions.addRunMaterialsEarned(materials);
  });
}

/** Dev / unlock-all: overwrite homestead materials. */
export function setMaterials(materials: MaterialInventory) {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.setMaterials(materials));
}

export function addMaterials(materials: MaterialInventory): void {
  dispatchRunSessionCommand(() => readGameplayState().runProfileActions.addMaterials(materials));
}

export function constructBuilding(id: BuildingId): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.constructBuilding(id));
}

export function plantFarm(id: FarmId): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.plantFarm(id));
}

export function completeResearch(id: ResearchId): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.completeResearch(id));
}

export function bondCompanion(id: CompanionId): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.bondCompanion(id));
}

export function unlockTalent(keywordId: KeywordId, talentId: string): void {
  dispatchRunSessionCommand(() => readGameplayState().runProfileActions.unlockTalent(keywordId, talentId));
}

export function resetUnlockedTalents(): void {
  dispatchRunSessionCommand(() => readGameplayState().runProfileActions.resetUnlockedTalents());
}

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents() {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    session.runProfileActions.unlockAllTalents();
    session.runActions.resetRunXP();
  });
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
export function finalizeRunXP(): void {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    const runTalentXP = session.run.activeRun.runTalentXP;
    if (Object.keys(runTalentXP).length === 0) {
      session.sessionActions.setRunEndTalentXP({});
      return;
    }
    const multiplier = getDifficultyXPMultiplier(session.run.activeRun.selectedDifficulty);
    session.sessionActions.setRunEndTalentXP(
      session.runProfileActions.mergeRunTalentXPIntoProfile(runTalentXP, multiplier),
    );
    session.runActions.resetRunXP();
  });
}
