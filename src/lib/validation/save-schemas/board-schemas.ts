import { z } from "zod";
import { isBoardId, STARTER_BOARD_ID, type BoardSelection } from "@/lib/boards/catalog";

const BoardIdSchema = z.string().refine(isBoardId);
export const BoardSelectionSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("random") }),
    z.object({ kind: z.literal("board"), boardId: BoardIdSchema }),
  ])
  .catch(() => ({ kind: "board" as const, boardId: STARTER_BOARD_ID }));
export const CollectedBoardIdsSchema = z
  .array(z.unknown())
  .catch(() => [STARTER_BOARD_ID])
  .transform((ids) => [
    ...new Set([STARTER_BOARD_ID, ...ids.filter((id): id is string => typeof id === "string" && isBoardId(id))]),
  ]);
export const NullableBoardIdSchema = BoardIdSchema.nullable().catch(null);
export const ActiveBoardIdSchema = BoardIdSchema.nullable().catch(null);

export function normalizeBoardSave<
  T extends {
    collectedBoardIds: string[];
    boardSelection: BoardSelection;
    activeBoardId: string | null;
    lastRandomBoardId: string | null;
    pendingBoardRewardId: string | null;
  },
>(save: T): T {
  const owned = new Set(save.collectedBoardIds);
  const isOwned = (id: string | null) => id !== null && owned.has(id);
  const boardSelection: BoardSelection =
    save.boardSelection.kind === "board" && !isOwned(save.boardSelection.boardId)
      ? { kind: "board", boardId: STARTER_BOARD_ID }
      : save.boardSelection;
  return {
    ...save,
    boardSelection,
    activeBoardId:
      boardSelection.kind === "none"
        ? null
        : boardSelection.kind === "board"
          ? boardSelection.boardId
          : isOwned(save.activeBoardId)
            ? save.activeBoardId
            : STARTER_BOARD_ID,
    lastRandomBoardId: isOwned(save.lastRandomBoardId) ? save.lastRandomBoardId : null,
    pendingBoardRewardId: isOwned(save.pendingBoardRewardId) ? save.pendingBoardRewardId : null,
  };
}
