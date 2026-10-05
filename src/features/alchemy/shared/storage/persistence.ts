import { acceptCommand } from "@/features/alchemy/shared/stores/command-outcome";
import { dispatchGameplayCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/gameplay-command";
import { gearPersistenceCodec } from "@/features/alchemy/shared/stores/gear-store";
import { subscribePersistenceCommits } from "@/features/alchemy/shared/stores/persistence-commit-filter";
import { discoverUniqueIds, profilePersistenceCodec } from "@/features/alchemy/shared/stores/profile-store";
import { runProfilePersistenceCodec } from "@/features/alchemy/shared/stores/run-profile-codec";
import type { ActiveRunData } from "@/lib/active-run-session";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { defaultGameSession } from "../stores/default-game-session";
import type { GameSession } from "../stores/game-session-types";
import { sessionRuntime } from "../stores/session-runtime";
import type { AlchemyPersistenceFields, UnstampedSaveData } from "./types";

export type { AlchemyPersistenceFields } from "./types";

export function encodePersistenceFields(gameSession: GameSession = defaultGameSession): AlchemyPersistenceFields {
  return {
    ...sessionRuntime(gameSession).settingsCodec.encode(),
    ...profilePersistenceCodec.encode(gameSession),
    ...gearPersistenceCodec.encode(gameSession),
    ...runProfilePersistenceCodec.encode(gameSession),
  };
}

function unionOwnedUniquesIntoDiscovered(draft: GameplayDraft): void {
  const owned = getOwnedUniqueDefinitionIds(draft.gear.inventories);
  if (owned.size === 0) return;
  discoverUniqueIds(draft, [...owned]);
}

export function hydrateAlchemyPersistenceFields(
  fields: AlchemyPersistenceFields,
  gameSession: GameSession = defaultGameSession,
): void {
  sessionRuntime(gameSession).settingsCodec.hydrate(fields);
  dispatchGameplayCommand(
    (draft) => {
      profilePersistenceCodec.hydrate(fields, draft);
      gearPersistenceCodec.hydrate(fields, draft);
      unionOwnedUniquesIntoDiscovered(draft);
      runProfilePersistenceCodec.hydrate(fields, draft);

      return acceptCommand();
    },
    undefined,
    gameSession,
  );
}

export function subscribeAlchemyPersistence(
  listener: () => void,
  gameSession: GameSession = defaultGameSession,
): () => void {
  return subscribePersistenceCommits(listener, gameSession);
}

export function buildAlchemySaveDataFromStores(
  activeRun: ActiveRunData | null,
  gameSession: GameSession = defaultGameSession,
): UnstampedSaveData {
  // Single save join point: flat persistence fields (settings/profile/gear/run
  // profile codecs) plus the active-run resume snapshot from run-lifecycle's
  // snapshotRun. Callers snapshot the run first; this function only stamps.
  const persistenceFields = encodePersistenceFields(gameSession);
  return {
    steamAccountId: null,
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    ...persistenceFields,
    activeRun,
  };
}
