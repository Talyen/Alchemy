// Shared tier-record helpers for Homestead persistence and runtime state.
// Item IDs and tier counts only, so storage and React state share one normalization path.

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
