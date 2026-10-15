import type { BoardSelection } from "@/lib/boards/catalog";
import type { GameSession } from "./game-session-types";
import { acceptCommand, rejectCommand, dispatchRunSessionCommand } from "./run-session-command";
import { selectBoard as select, acknowledgeBoardReward as acknowledge } from "./run-session-write-port";

export function selectGameBoard(selection: BoardSelection, gameSession: GameSession): boolean {
  return dispatchRunSessionCommand(
    (transaction) => (select(transaction, selection) ? acceptCommand(true) : rejectCommand("Board is locked", false)),
    undefined,
    gameSession,
  );
}
export function acknowledgeGameBoardReward(id: string, equip: boolean, gameSession: GameSession): boolean {
  return dispatchRunSessionCommand(
    (transaction) =>
      acknowledge(transaction, id, equip) ? acceptCommand(true) : rejectCommand("Board reward is unavailable", false),
    undefined,
    gameSession,
  );
}
