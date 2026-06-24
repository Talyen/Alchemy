// Immediate save flush from live stores (bypasses autosave debounce / screen gates).
import type { ActiveRunData } from "@/lib/active-run-session";
import type { MaterialInventory, BuildingId, FarmId, ResearchId, HomesteadEffectManifest } from "@/lib/homestead/types";
import type { CompanionId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import { buildAlchemySaveDataFromStores } from "./build-save-data-from-stores";
import { saveAlchemySaveData } from "./io";

interface ProgressSnapshot {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
  effects: HomesteadEffectManifest;
}

export async function flushAlchemySaveNow(
  activeRun: ActiveRunData | null,
  progress?: ProgressSnapshot,
  talentXP?: TalentXP,
  unlockedTalents?: UnlockedTalents,
) {
  await saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun, progress, talentXP, unlockedTalents));
}
