import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import {
  abandonRun,
  applyRunDefeatTeardown,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/commands/run-lifecycle";

export function completeRunVictory(gameSession: GameSession): void {
  finalizeRunEndSession(gameSession);
}
export function completeRunDefeat(gameSession: GameSession): void {
  applyRunDefeatTeardown(gameSession);
}
export function abandonCurrentRun(gameSession: GameSession): boolean {
  return abandonRun(gameSession);
}
