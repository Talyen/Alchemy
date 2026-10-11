import { acceptCommand } from "@/features/alchemy/shared/stores/command-outcome";
import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { gearPersistenceCodec } from "@/features/alchemy/shared/stores/gear-store";
import { subscribePersistenceCommits } from "@/features/alchemy/shared/stores/persistence-commit-filter";
import { profilePersistenceCodec } from "@/features/alchemy/shared/stores/profile-store";
import { runProfilePersistenceCodec } from "@/features/alchemy/shared/stores/run-profile-codec";
import { hydrateGameplayPersistenceFields } from "../stores/persistence-hydration";
import { isActiveRunActivity } from "@/lib/active-run-session";
import { getRunSessionFromState } from "../stores/run-reads";
import { encodeRunResumeSnapshot } from "../stores/run-resume-codec";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import type { GameSession } from "../stores/game-session-types";
import { sessionRuntime } from "../stores/session-runtime";
import type { AlchemyPersistenceFields, UnstampedSaveData } from "./types";

export type { AlchemyPersistenceFields } from "./types";

export function encodePersistenceFields(gameSession: GameSession): AlchemyPersistenceFields {
  return {
    ...sessionRuntime(gameSession).settingsCodec.encode(),
    ...profilePersistenceCodec.encode(gameSession),
    ...gearPersistenceCodec.encode(gameSession),
    ...runProfilePersistenceCodec.encode(gameSession),
  };
}

export function hydrateAlchemyPersistenceFields(fields: AlchemyPersistenceFields, gameSession: GameSession): void {
  dispatchGameplayCommand(
    (draft) => {
      hydrateGameplayPersistenceFields(fields, draft);
      return acceptCommand();
    },
    undefined,
    gameSession,
  );
  sessionRuntime(gameSession).settingsCodec.hydrate(fields);
}

export function subscribeAlchemyPersistence(listener: () => void, gameSession: GameSession): () => void {
  return subscribePersistenceCommits(listener, gameSession);
}

export function buildAlchemySaveDataFromStores(gameSession: GameSession): UnstampedSaveData {
  const runtime = sessionRuntime(gameSession);
  const state = runtime.gameplay.reads.getState();
  const token = runtime.progressCompletion.token(state.revision);
  try {
    const activeRun = isActiveRunActivity(state.session.activity)
      ? encodeRunResumeSnapshot(getRunSessionFromState(state))
      : null;
    // Own every nested value: a save must not retain live state or draft views.
    const save = structuredClone({
      steamAccountId: null,
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
      ...encodePersistenceFields(gameSession),
      activeRun,
    });
    return runtime.progressCompletion.captureSnapshot(save, state.revision);
  } catch (error) {
    runtime.progressCompletion.complete(token, "failed");
    throw error;
  }
}
