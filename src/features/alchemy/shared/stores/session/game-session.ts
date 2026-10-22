import type { UnstampedSaveData } from "../../storage/types";
import type { GameSessionOptions } from "./game-session-types";
import { restoreSessionSave } from "../commands/run-lifecycle";
import { createSessionRuntime } from "./session-runtime";
export type { GameSession, GameSessionOptions, SessionClock } from "./game-session-types";

export function createGameSession(options: GameSessionOptions & { initialSave?: UnstampedSaveData } = {}) {
  const session = createSessionRuntime(options);
  if (options.initialSave) {
    restoreSessionSave(options.initialSave, session);
  }
  return session;
}
