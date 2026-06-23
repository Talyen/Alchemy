// Content IDs that have been intentionally removed from the live catalogs but
// may still appear in older saves.
// The guard test in save-migration-guard.test.ts enforces that legacy fixtures
// only reference live catalog IDs or explicitly tombstoned IDs.
//
// Adding a new tombstone:
//   1. Add the ID to the TOMBSTONED_CARD_IDS set below.
//   2. Add a guard test in tests/architecture/save-migration-guard.test.ts
//      that asserts legacy fixtures don't reference un-tombstoned IDs.

import type { RawSaveData } from "./types";

export const TOMBSTONED_CARD_IDS: ReadonlySet<string> = new Set<string>(["future-card"]);

export function isTombstonedCardId(id: string): boolean {
  return TOMBSTONED_CARD_IDS.has(id);
}

// Returns a RawSaveData with tombstoned IDs pruned from discoveredCardIds.
export function pruneTombstonedIds(parsed: RawSaveData): RawSaveData {
  const next: RawSaveData = { ...parsed };

  if (Array.isArray(next.discoveredCardIds)) {
    next.discoveredCardIds = (next.discoveredCardIds as string[]).filter((id) => !isTombstonedCardId(id));
  }

  return next;
}
