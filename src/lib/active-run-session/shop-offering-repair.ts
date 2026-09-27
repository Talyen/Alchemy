export function shopItemSlotKey(id: string, index: number): string {
  return `${id}-${index}`;
}

export function defaultShopSlotKeyOf(item: unknown, index: number): string {
  if (typeof item === "object" && item !== null && "instanceId" in item) {
    return String(item.instanceId);
  }
  if (typeof item === "object" && item !== null && "id" in item) {
    return shopItemSlotKey(String(item.id), index);
  }
  return shopItemSlotKey(String(item), index);
}

export function repairShopOfferings<T>(
  items: readonly T[],
  purchasedSlotKeys: readonly string[],
  keep: (item: T) => boolean,
  slotKeyOf: (item: T, index: number) => string = defaultShopSlotKeyOf,
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
