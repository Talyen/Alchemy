/** Slot identity for card/trinket shelves. Duplicate item IDs are legal, so the index is part of the key. */
export function shopItemSlotKey(id: string, index: number): string {
  return `${id}-${index}`;
}

/**
 * Drop offerings that fail `keep` and remap `purchasedSlotKeys` in the same pass.
 * Old keys are computed from the original index; survivors get keys for their new index.
 */
export function repairShopOfferings<T>(
  items: readonly T[],
  purchasedSlotKeys: readonly string[],
  keep: (item: T) => boolean,
  slotKeyOf: (item: T, index: number) => string,
): { items: T[]; purchasedSlotKeys: string[] } {
  const purchased = new Set(purchasedSlotKeys);
  const nextItems: T[] = [];
  const nextKeys: string[] = [];
  items.forEach((item, oldIndex) => {
    if (!keep(item)) return;
    const oldKey = slotKeyOf(item, oldIndex);
    const newKey = slotKeyOf(item, nextItems.length);
    nextItems.push(item);
    if (purchased.has(oldKey)) nextKeys.push(newKey);
  });
  return { items: nextItems, purchasedSlotKeys: nextKeys };
}
