import type { RawSaveData } from "./types";

/** Remaps legacy wildwood draft enum values. Idempotent for already-migrated saves. */
export function migrateWildwoodDraft(draft: unknown): unknown {
  if (!draft || typeof draft !== "object") return draft;
  const state = draft as RawSaveData;
  if (state.rewardType === "trinket") {
    return { ...state, rewardType: "boon" };
  }
  return draft;
}
