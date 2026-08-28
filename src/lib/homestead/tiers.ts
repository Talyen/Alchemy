export interface TieredItem<T extends string = string> {
  id: T;
  tiers: readonly unknown[];
}

export function createEmptyTierRecord<T extends string>(items: ReadonlyArray<TieredItem<T>>): Record<T, number> {
  const record = {} as Record<T, number>;
  for (const { id } of items) {
    record[id] = 0;
  }
  return record;
}
