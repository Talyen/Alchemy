// Immediate save flush from live stores (bypasses autosave debounce / screen gates).
import type { ActiveRunData } from "@/lib/active-run-session";
import type { TalentXP, UnlockedTalents } from "@/lib/game-data";
import { buildAlchemySaveDataFromStores, type ProgressSnapshot } from "./build-save-data-from-stores";
import { saveAlchemySaveData } from "./io";

export async function flushAlchemySaveNow(
  activeRun: ActiveRunData | null,
  progress?: ProgressSnapshot,
  talentXP?: TalentXP,
  unlockedTalents?: UnlockedTalents,
) {
  await saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun, progress, talentXP, unlockedTalents));
}
