export const TOMBSTONED_CARD_IDS: ReadonlySet<string> = new Set<string>(["imp-companion", "antivenom-potion"]);

export function isTombstonedCardId(id: string): boolean {
  return TOMBSTONED_CARD_IDS.has(id);
}
