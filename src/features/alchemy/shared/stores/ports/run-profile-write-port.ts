// Permanent-profile write port — the only place run-loop code mutates meta progression.
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
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
