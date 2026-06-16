import type { RawSaveData } from "./types";

/** v3→v4 wildwood draft remap (frozen). */
export function migrateWildwoodDraftV4(draft: unknown): unknown {
  if (!draft || typeof draft !== "object") return draft;
  const state = draft as RawSaveData;
  if (state.rewardType === "trinket") {
    return { ...state, rewardType: "boon" };
  }
  return draft;
}
