import { hydrateAlchemyPersistenceFields } from "../storage/persistence";
import type { UnstampedSaveData } from "../storage/types";
import type { GameSessionOptions } from "./game-session-types";
import { restoreRun } from "./run-lifecycle";
import { createSessionRuntime } from "./session-runtime";
export type { GameSession, GameSessionOptions, SessionClock } from "./game-session-types";

export function createGameSession(options: GameSessionOptions & { initialSave?: UnstampedSaveData } = {}) {
  const session = createSessionRuntime(options);
  if (options.initialSave) {
    hydrateAlchemyPersistenceFields(options.initialSave, session);
    restoreRun(
      options.initialSave.activeRun,
      options.initialSave.talentXP,
      options.initialSave.unlockedTalents,
      session,
    );
  }
  return session;
}
