import type { ActiveRunData } from "@/lib/active-run-session";
import { buildAlchemySaveDataFromStores } from "./persistence";
import { saveAlchemySaveData } from "./io";

export async function flushAlchemySaveNow(activeRun: ActiveRunData | null) {
  await saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun));
}
