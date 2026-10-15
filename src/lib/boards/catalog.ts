import entries from "./catalog.json";

export const boardCatalog = entries;
export const STARTER_BOARD_ID = "acorn";
export const BOARD_REWARD_ROOM_THRESHOLD = 5;
export type BoardSelection = { kind: "none" } | { kind: "random" } | { kind: "board"; boardId: string };
export function isBoardId(id: string): boolean {
  return boardCatalog.some((board) => board.id === id);
}

export function pickCollectedBoard(
  ids: readonly string[],
  previous: string | null,
  random: () => number,
): string | null {
  const candidates = ids.length > 1 ? ids.filter((id) => id !== previous) : ids;
  return candidates.length
    ? (candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] ?? null)
    : null;
}
