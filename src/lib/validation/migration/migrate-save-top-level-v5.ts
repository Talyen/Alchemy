import { migrateActiveRun } from "./migrate-active-run";
import type { RawSaveData } from "./types";

/** Top-level save field renames introduced at schema v5 (Boon → Trinket revert). */
export function migrateSaveTopLevelV5(parsed: RawSaveData): RawSaveData {
  const activeRun =
    parsed.activeRun && typeof parsed.activeRun === "object" ? migrateActiveRun(parsed.activeRun) : parsed.activeRun;

  const next: RawSaveData = {
    ...parsed,
    discoveredTrinketIds: Array.isArray(parsed.discoveredTrinketIds)
      ? parsed.discoveredTrinketIds
      : Array.isArray(parsed.discoveredBoonIds)
        ? parsed.discoveredBoonIds
        : [],
    activeRun,
  };
  delete next.discoveredBoonIds;
  return next;
}
