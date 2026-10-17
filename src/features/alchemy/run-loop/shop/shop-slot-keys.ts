import { shopItemSlotKey } from "@/lib/active-run-session";

export { shopItemSlotKey };

export function shopOfferingsSwapKey(slotKeys: readonly string[], refreshesLeft: number): string {
  return `${refreshesLeft}:${slotKeys.join("|")}`;
}
