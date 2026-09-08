import { shopItemSlotKey } from "@/lib/active-run-session";

export { shopItemSlotKey };

export function shopOfferingsSwapKey(slotKeys: readonly string[], refreshesLeft: number): string {
  return `${refreshesLeft}:${slotKeys.join("|")}`;
}

export function findShopOffering<T>(
  items: readonly T[],
  slotKey: string,
  getSlotKey: (item: T, index: number) => string,
): T | undefined {
  return items.find((item, index) => getSlotKey(item, index) === slotKey);
}
