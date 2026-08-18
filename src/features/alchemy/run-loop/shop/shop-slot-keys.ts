export function shopOfferingsSwapKey(slotKeys: readonly string[], refreshesLeft: number): string {
  return `${refreshesLeft}:${slotKeys.join("|")}`;
}

export function shopItemSlotKey(id: string, index: number): string {
  return `${id}-${index}`;
}

export function shopArrayOfferingMatches<T>(
  items: readonly T[],
  slotKey: string,
  itemId: string,
  getId: (item: T) => string,
): boolean {
  return items.some((item, index) => shopItemSlotKey(getId(item), index) === slotKey && getId(item) === itemId);
}
