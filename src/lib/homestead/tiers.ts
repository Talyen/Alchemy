import type { MaterialInventory } from "./types";

export interface TieredItem<T extends string = string, TTier = { cost: MaterialInventory }> {
  id: T;
  tiers: readonly TTier[];
}

export function createEmptyTierRecord<T extends string, TTier = { cost: MaterialInventory }>(
  items: ReadonlyArray<TieredItem<T, TTier>>,
): Record<T, number> {
  const record = {} as Record<T, number>;
  for (const { id } of items) {
    record[id] = 0;
  }
  return record;
}

export function createTierLookup<T extends string, TTier = { cost: MaterialInventory }>(
  items: ReadonlyArray<TieredItem<T, TTier>>,
): Map<T, TieredItem<T, TTier>> {
  return new Map(items.map((item) => [item.id, item]));
}
