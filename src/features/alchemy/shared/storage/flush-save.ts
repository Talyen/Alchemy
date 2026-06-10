// Immediate save flush from live stores (bypasses autosave debounce / screen gates).
import type { ActiveRunData } from "@/lib/active-run-session";
import { buildAlchemySaveDataFromStores } from "./build-save-data-from-stores";
import { saveAlchemySaveData } from "./io";

export async function flushAlchemySaveNow(activeRun: ActiveRunData | null) {
  await saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun));
}
