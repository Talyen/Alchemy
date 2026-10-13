import type { GameSession } from "./game-session-types";
import { sessionRuntime } from "./session-runtime";

/** Imperative settings capability for session controllers. */
export function readSessionSettings(gameSession: GameSession) {
  return sessionRuntime(gameSession).settings.getState();
}
