// Shared tier-record helpers for Homestead persistence and runtime state.
// Depends only on item IDs and tier counts so storage and React state use one normalization path.

export interface TieredItem<T extends string = string> {
  id: T;
  tiers: readonly unknown[];
}

// Creates a complete zero-filled tier record for all known items.
export function createEmptyTierRecord<T extends string>(items: ReadonlyArray<TieredItem<T>>): Record<T, number> {
  const record = {} as Record<T, number>;
  for (const { id } of items) {
    record[id] = 0;
  }
  return record;
}

function clampTierLevel(value: unknown, maxTier: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maxTier, Math.floor(value)));
}

// Normalizes legacy string arrays and current record-shaped saves into a complete,
// clamped tier record. Rename maps preserve progress when content IDs change.
export function normalizeTierRecord<T extends string>(
  value: unknown,
  items: ReadonlyArray<TieredItem<T>>,
  renameMap: Record<string, T> = {},
): Record<T, number> {
  const result = createEmptyTierRecord(items);
  const maxById = new Map(items.map((item) => [item.id, item.tiers.length]));

  function applyLevel(rawId: unknown, rawLevel: unknown) {
    if (typeof rawId !== "string") return;
    const id = renameMap[rawId] ?? rawId;
    const maxTier = maxById.get(id as T);
    if (maxTier === undefined) return;
    result[id as T] = Math.max(result[id as T], clampTierLevel(rawLevel, maxTier));
  }

  if (Array.isArray(value)) {
    for (const id of value) {
      applyLevel(id, 1);
    }
    return result;
  }

  if (value && typeof value === "object") {
    for (const [id, level] of Object.entries(value as Record<string, unknown>)) {
      applyLevel(id, level);
    }
  }

  return result;
}
