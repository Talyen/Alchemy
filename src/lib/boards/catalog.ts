import entries from "./catalog.json";

export const boardCatalog = entries;
export const STARTER_BOARD_ID = "acorn";
export type BoardSelection = { kind: "none" } | { kind: "random" } | { kind: "board"; boardId: string };

const boardIdSet = new Set(boardCatalog.map((board) => board.id));

export function isBoardId(id: string): boolean {
  return boardIdSet.has(id);
}

export function pickCollectedBoard(
  ids: readonly string[],
  previous: string | null,
  random: () => number,
): string | null {
  const candidates = ids.length > 1 ? ids.filter((id) => id !== previous) : ids;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)] ?? null;
}
