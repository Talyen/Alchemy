import { getBossById } from "@/features/alchemy/shared/config";
import { logError } from "@/lib/error-logger";
import type {
  BattleStarted,
  BattleStartOptions,
  BattleStartRequest,
  BossBattleStartOptions,
  BossByIdOptions,
} from "./battle-start-types";
import { defaultGameSession } from "./default-game-session";
import type { GameSession } from "./game-session-types";
import { acceptCommand, dispatchRunSessionCommand, rejectCommand } from "./run-session-command";
import { initializeBattle } from "./run-session-write-port";

export type { BattleStarted, BattleStartOptions } from "./battle-start-types";
export type BattleStartCommands = ReturnType<typeof createBattleStartCommands>;

export function createBattleStartCommands(
  onStarted: (result: BattleStarted) => void,
  gameSession: GameSession = defaultGameSession,
) {
  function beginBattle(request: BattleStartRequest) {
    return dispatchRunSessionCommand(
      (transaction) => {
        const result = initializeBattle(transaction, request);
        return result
          ? acceptCommand(result)
          : rejectCommand("Battle cannot be started from the current activity", null);
      },
      {
        afterCommit: (result) => {
          if (result) onStarted(result);
        },
      },
      gameSession,
    );
  }
  function startBattle(options: BattleStartOptions = {}) {
    return beginBattle({ kind: "battle", options });
  }
  function startBossBattle(options: BossBattleStartOptions = {}) {
    return beginBattle({ kind: "boss", options });
  }
  function startBossById(options: BossByIdOptions): boolean {
    if (!getBossById(options.bossId)) {
      logError(`Failed to start boss "${options.bossId}" (unknown boss id)`, "battle");
      return false;
    }
    return beginBattle({ kind: "boss-by-id", options }) !== null;
  }
  return { startBattle, startBossBattle, startBossById, presentBattleStart: onStarted };
}
