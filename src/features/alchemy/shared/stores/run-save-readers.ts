// Persistence read helpers for save snapshots — kept separate from run-session-facade
// so storage/build-save-data-from-stores does not pull run-transitions into the graph.
import type { TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { getRunDomainStore, type RunProgressStore } from "./run-domain-store";

export type HomesteadSaveFields = Pick<
  RunProgressStore,
  "materialInventory" | "constructedBuildings" | "plantedFarms" | "completedResearch" | "bondedCompanions"
>;

/** Persistence: permanent homestead + talent fields for save snapshots. */
export function readPermanentProgressForSave(): HomesteadSaveFields & {
  effects: HomesteadEffectManifest;
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
} {
  const permanent = getRunDomainStore().progress.permanent;
  return {
    materialInventory: permanent.materialInventory,
    constructedBuildings: permanent.constructedBuildings,
    plantedFarms: permanent.plantedFarms,
    completedResearch: permanent.completedResearch,
    bondedCompanions: permanent.bondedCompanions,
    effects: permanent.effects,
    talentXP: permanent.talentXP,
    unlockedTalents: permanent.unlockedTalents,
  };
}
