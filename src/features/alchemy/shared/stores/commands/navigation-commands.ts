import type { GameSession } from "../session/game-session-types";
import { acceptCommand, dispatchRunSessionCommand, rejectCommand } from "./run-session-command";
import { resetUnlockedTalents, setScreen, unlockAllTalents, unlockTalent } from "./run-session-write-port";

export function showRunScreen(screen: Parameters<typeof setScreen>[1], gameSession: GameSession) {
  dispatchRunSessionCommand((transaction) => acceptCommand(setScreen(transaction, screen)), undefined, gameSession);
}
export function purchaseTalent(
  keyword: Parameters<typeof unlockTalent>[1],
  talent: Parameters<typeof unlockTalent>[2],
  gameSession: GameSession,
) {
  dispatchRunSessionCommand(
    (transaction) =>
      unlockTalent(transaction, keyword, talent)
        ? acceptCommand()
        : rejectCommand("Talent cannot be unlocked", undefined),
    undefined,
    gameSession,
  );
}
export function resetTalentUnlocks(gameSession: GameSession) {
  dispatchRunSessionCommand((transaction) => acceptCommand(resetUnlockedTalents(transaction)), undefined, gameSession);
}
export function unlockTalentsForDevelopment(gameSession: GameSession) {
  dispatchRunSessionCommand((transaction) => acceptCommand(unlockAllTalents(transaction)), undefined, gameSession);
}
