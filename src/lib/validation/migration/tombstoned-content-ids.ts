// Deliberate content removals, kept explicit for fixtures. Load drops every
// non-live id against the live catalog (see normalize-active-run-data); this
// list must stay absent from the catalog or the drift test below fails.
export const TOMBSTONED_CARD_IDS: readonly string[] = ["imp-companion", "antivenom-potion"];

const TOMBSTONED_CARD_ID_SET: ReadonlySet<string> = new Set<string>(TOMBSTONED_CARD_IDS);

export function isTombstonedCardId(id: string): boolean {
  return TOMBSTONED_CARD_ID_SET.has(id);
}
