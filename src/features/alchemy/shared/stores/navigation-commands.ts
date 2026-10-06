import { defaultGameSession } from "./default-game-session";
import type { GameSession } from "./game-session-types";
import { dispatchGameplayCommand } from "./gameplay-command";
import { acceptCommand, rejectCommand } from "./run-session-command";
import { resetUnlockedTalents, unlockAllTalents, unlockTalent } from "./write/run-meta";
import { setScreen } from "./write/run-navigation";
import { abandonLabyrinthCorruptionVisit } from "./write/run-session";

export function showRunScreen(screen: Parameters<typeof setScreen>[1], gameSession: GameSession = defaultGameSession) {
  dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, screen)), undefined, gameSession);
}
export function purchaseTalent(
  keyword: Parameters<typeof unlockTalent>[1],
  talent: Parameters<typeof unlockTalent>[2],
  gameSession: GameSession = defaultGameSession,
) {
  dispatchGameplayCommand(
    (draft) =>
      unlockTalent(draft, keyword, talent) ? acceptCommand() : rejectCommand("Talent cannot be unlocked", undefined),
    undefined,
    gameSession,
  );
}
export function resetTalentUnlocks(gameSession: GameSession = defaultGameSession) {
  dispatchGameplayCommand((draft) => acceptCommand(resetUnlockedTalents(draft)), undefined, gameSession);
}
export function unlockTalentsForDevelopment(gameSession: GameSession = defaultGameSession) {
  dispatchGameplayCommand((draft) => acceptCommand(unlockAllTalents(draft)), undefined, gameSession);
}
export function leaveLabyrinthCorruption(gameSession: GameSession = defaultGameSession) {
  dispatchGameplayCommand((draft) => acceptCommand(abandonLabyrinthCorruptionVisit(draft)), undefined, gameSession);
}
