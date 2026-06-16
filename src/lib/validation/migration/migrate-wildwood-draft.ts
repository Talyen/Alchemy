import { remapLegacyBoonContentId } from "./migrate-content-v2";
import type { RawSaveData } from "./types";

function remapTraitIds(ids: unknown): unknown {
  if (!Array.isArray(ids)) return ids;
  return ids.map((id) => (typeof id === "string" ? remapLegacyBoonContentId(id) : id));
}

/** Remaps legacy wildwood draft enum values. Idempotent for already-migrated saves. */
export function migrateWildwoodDraft(draft: unknown): unknown {
  if (!draft || typeof draft !== "object") return draft;
  const state = draft as RawSaveData;
  const next: RawSaveData = {
    ...state,
    currentCombatTraitIds: remapTraitIds(state.currentCombatTraitIds),
    currentRewardTraitIds: remapTraitIds(state.currentRewardTraitIds),
  };
  if (state.rewardType === "boon") {
    next.rewardType = "trinket";
  }
  return next;
}
