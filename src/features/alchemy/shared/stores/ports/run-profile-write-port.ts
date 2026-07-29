// Permanent-profile write port — the only place run-loop code mutates meta progression.
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { getRunProfileStore } from "../run-profile-store";
import { getRunTransientStore } from "../run-transient-store";
import { getRunDomainStore } from "../run-domain-store";

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(materials: MaterialInventory) {
  getRunProfileStore().addMaterials(materials);
  getRunDomainStore().addRunMaterialsEarned(materials);
}

/** Dev / unlock-all: overwrite homestead materials. */
export function setMaterials(materials: MaterialInventory) {
  getRunProfileStore().setMaterials(materials);
}

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents() {
  getRunProfileStore().unlockAllTalents();
  getRunDomainStore().resetRunXP();
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
export function finalizeRunXP(): void {
  const domain = getRunDomainStore();
  const transient = getRunTransientStore();
  const runTalentXP = domain.activeRun.runTalentXP;
  if (Object.keys(runTalentXP).length === 0) {
    transient.setRunEndTalentXP({});
    return;
  }
  const multiplier = getDifficultyXPMultiplier(domain.activeRun.selectedDifficulty);
  transient.setRunEndTalentXP(getRunProfileStore().mergeRunTalentXPIntoProfile(runTalentXP, multiplier));
  domain.resetRunXP();
}
