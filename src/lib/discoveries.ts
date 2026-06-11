// Run-end discovery delta and pack batching helpers.
/** Matches Collection card row (`grid-cols-4`). */
const DISCOVERY_CARD_PACK_SIZE = 4;
/** Matches Collection trinket row (`grid-cols-3`). */
const DISCOVERY_TRINKET_PACK_SIZE = 3;

export function computeRunDiscoveryDelta(currentIds: readonly string[], snapshotIds: readonly string[]): string[] {
  const snapshotSet = new Set(snapshotIds);
  return currentIds.filter((id) => !snapshotSet.has(id));
}

export function chunkIds(ids: readonly string[], size: number): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export type DiscoveryPackBatch = { kind: "cards" | "trinkets"; ids: string[] };

export function buildDiscoveryPackPlan(
  cardIds: readonly string[],
  trinketIds: readonly string[],
): DiscoveryPackBatch[] {
  return [
    ...chunkIds(cardIds, DISCOVERY_CARD_PACK_SIZE).map((ids) => ({ kind: "cards" as const, ids })),
    ...chunkIds(trinketIds, DISCOVERY_TRINKET_PACK_SIZE).map((ids) => ({ kind: "trinkets" as const, ids })),
  ];
}

export function hasRunEndDiscoveries(cardIds: readonly string[], trinketIds: readonly string[]): boolean {
  return cardIds.length > 0 || trinketIds.length > 0;
}
