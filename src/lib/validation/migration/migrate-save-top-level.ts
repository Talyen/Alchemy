import { migrateActiveRun } from "./migrate-active-run";
import type { RawSaveData } from "./types";

/** Top-level save field renames and defaults introduced at schema v4. */
export function migrateSaveTopLevelV4(parsed: RawSaveData): RawSaveData {
  const activeRun =
    parsed.activeRun && typeof parsed.activeRun === "object" ? migrateActiveRun(parsed.activeRun) : parsed.activeRun;

  const next: RawSaveData = {
    ...parsed,
    discoveredBoonIds: Array.isArray(parsed.discoveredBoonIds)
      ? parsed.discoveredBoonIds
      : Array.isArray(parsed.discoveredTrinketIds)
        ? parsed.discoveredTrinketIds
        : [],
    gearInventory: Array.isArray(parsed.gearInventory) ? parsed.gearInventory : [],
    gearLoadouts: parsed.gearLoadouts && typeof parsed.gearLoadouts === "object" ? parsed.gearLoadouts : {},
    activeRun,
  };
  delete next.discoveredTrinketIds;
  return next;
}
