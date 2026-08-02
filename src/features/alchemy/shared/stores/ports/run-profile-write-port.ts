// Permanent-profile write port — the only place run-loop code mutates meta progression.
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { CompanionId, KeywordId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import { dispatchRunSessionCommand } from "../run-session-command";
import { createRunSessionStoreSnapshot } from "../run-session-queries";

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(materials: MaterialInventory) {
  dispatchRunSessionCommand(() => {
    const session = createRunSessionStoreSnapshot();
    session.runProfile.addMaterials(materials);
    session.domain.addRunMaterialsEarned(materials);
  });
}

/** Dev / unlock-all: overwrite homestead materials. */
export function setMaterials(materials: MaterialInventory) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().runProfile.setMaterials(materials));
}

export function addMaterials(materials: MaterialInventory): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().runProfile.addMaterials(materials));
}

export function constructBuilding(id: BuildingId): boolean {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().runProfile.constructBuilding(id));
}

export function plantFarm(id: FarmId): boolean {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().runProfile.plantFarm(id));
}

export function completeResearch(id: ResearchId): boolean {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().runProfile.completeResearch(id));
}

export function bondCompanion(id: CompanionId): boolean {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().runProfile.bondCompanion(id));
}

export function unlockTalent(keywordId: KeywordId, talentId: string): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().runProfile.unlockTalent(keywordId, talentId));
}

export function resetUnlockedTalents(): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().runProfile.resetUnlockedTalents());
}

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents() {
  dispatchRunSessionCommand(() => {
    const session = createRunSessionStoreSnapshot();
    session.runProfile.unlockAllTalents();
    session.domain.resetRunXP();
  });
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
export function finalizeRunXP(): void {
  dispatchRunSessionCommand(() => {
    const session = createRunSessionStoreSnapshot();
    const domain = session.domain;
    const transient = session.transient;
    const runTalentXP = domain.activeRun.runTalentXP;
    if (Object.keys(runTalentXP).length === 0) {
      transient.setRunEndTalentXP({});
      return;
    }
    const multiplier = getDifficultyXPMultiplier(domain.activeRun.selectedDifficulty);
    transient.setRunEndTalentXP(session.runProfile.mergeRunTalentXPIntoProfile(runTalentXP, multiplier));
    domain.resetRunXP();
  });
}
