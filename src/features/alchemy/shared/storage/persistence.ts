import { settingsPersistenceCodec } from "@/features/alchemy/shared/stores/settings-store";
import { discoverUniqueIds, profilePersistenceCodec } from "@/features/alchemy/shared/stores/profile-store";
import { gearPersistenceCodec } from "@/features/alchemy/shared/stores/gear-store";
import { runProfilePersistenceCodec } from "@/features/alchemy/shared/stores/run-profile-codec";
import { subscribePersistenceCommits } from "@/features/alchemy/shared/stores/persistence-commit-filter";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { AlchemyPersistenceFields, UnstampedSaveData } from "./types";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";

export type { AlchemyPersistenceFields } from "./types";

export function encodePersistenceFields(): AlchemyPersistenceFields {
  return {
    ...settingsPersistenceCodec.encode(),
    ...profilePersistenceCodec.encode(),
    ...gearPersistenceCodec.encode(),
    ...runProfilePersistenceCodec.encode(),
  };
}

function unionOwnedUniquesIntoDiscovered(draft: GameplayDraft): void {
  const owned = getOwnedUniqueDefinitionIds(draft.gear.inventories);
  if (owned.size === 0) return;
  discoverUniqueIds(draft, [...owned]);
}

export function hydrateAlchemyPersistenceFields(fields: AlchemyPersistenceFields): void {
  settingsPersistenceCodec.hydrate(fields);
  dispatchRunSessionCommand((draft) => {
    profilePersistenceCodec.hydrate(fields, draft);
    gearPersistenceCodec.hydrate(fields, draft);
    unionOwnedUniquesIntoDiscovered(draft);
    runProfilePersistenceCodec.hydrate(fields, draft);
  });
}

export function subscribeAlchemyPersistence(listener: () => void): () => void {
  return subscribePersistenceCommits(listener);
}

export function buildAlchemySaveDataFromStores(activeRun: ActiveRunData | null): UnstampedSaveData {
  // Single save join point: flat persistence fields (settings/profile/gear/run
  // profile codecs) plus the active-run resume snapshot from run-lifecycle's
  // snapshotRun. Callers snapshot the run first; this function only stamps.
  const persistenceFields = encodePersistenceFields();
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    ...persistenceFields,
    activeRun,
  };
}
