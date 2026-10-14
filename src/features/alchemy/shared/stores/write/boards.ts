import {
  boardCatalog,
  BOARD_REWARD_ROOM_THRESHOLD,
  isBoardId,
  pickCollectedBoard,
  type BoardSelection,
} from "@/lib/boards/catalog";
import { gameplayDraftRuntime, type GameplayDraft } from "../gameplay-command";

export function resolveBattleBoard(draft: GameplayDraft): void {
  const profile = draft.profile;
  const selection = profile.boardSelection;
  if (selection.kind === "random") {
    profile.activeBoardId = pickCollectedBoard(
      profile.collectedBoardIds,
      profile.lastRandomBoardId,
      gameplayDraftRuntime(draft).cosmeticRandom,
    );
    profile.lastRandomBoardId = profile.activeBoardId;
  } else profile.activeBoardId = selection.kind === "board" ? selection.boardId : null;
}

export function selectBoard(draft: GameplayDraft, selection: BoardSelection): boolean {
  if (
    selection.kind === "board" &&
    (!isBoardId(selection.boardId) || !draft.profile.collectedBoardIds.includes(selection.boardId))
  )
    return false;
  const previous = draft.profile.boardSelection;
  if (
    previous.kind === selection.kind &&
    (selection.kind !== "board" || (previous.kind === "board" && previous.boardId === selection.boardId))
  )
    return true;
  draft.profile.boardSelection = { ...selection };
  resolveBattleBoard(draft);
  return true;
}

export function awardRunBoard(draft: GameplayDraft, ending: "victory" | "death" | "abandoned"): void {
  if (
    ending === "abandoned" ||
    draft.run.activeRun.runHistory.filter((room) => room.completed).length < BOARD_REWARD_ROOM_THRESHOLD
  )
    return;
  const uncollected = boardCatalog
    .filter((board) => !draft.profile.collectedBoardIds.includes(board.id))
    .map((board) => board.id);
  const id = pickCollectedBoard(uncollected, null, gameplayDraftRuntime(draft).cosmeticRandom);
  if (!id) return;
  draft.profile.collectedBoardIds.push(id);
  draft.profile.pendingBoardRewardId = id;
}

export function acknowledgeBoardReward(draft: GameplayDraft, boardId: string, equip: boolean): boolean {
  if (draft.profile.pendingBoardRewardId !== boardId) return false;
  if (equip && !selectBoard(draft, { kind: "board", boardId })) return false;
  draft.profile.pendingBoardRewardId = null;
  return true;
}

export function unlockAllBoards(draft: GameplayDraft): void {
  draft.profile.collectedBoardIds = boardCatalog.map((board) => board.id);
}
