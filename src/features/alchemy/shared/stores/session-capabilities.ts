import type { GameSession } from "./game-session-types";
import { sessionRuntime } from "./session-runtime";

export function sessionFeedback(gameSession: GameSession) {
  return sessionRuntime(gameSession).feedback;
}

export function sessionClock(gameSession: GameSession) {
  return sessionRuntime(gameSession).clock;
}

export function registerSessionCleanup(gameSession: GameSession, cleanup: () => void): () => void {
  return sessionRuntime(gameSession).track(cleanup);
}
