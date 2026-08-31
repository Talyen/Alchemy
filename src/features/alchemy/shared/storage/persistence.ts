import { settingsPersistenceCodec, type SettingsSaveFields } from "@/features/alchemy/shared/stores/settings-store";
import {
  discoverUniqueIds,
  profilePersistenceCodec,
  type ProfileSaveFields,
} from "@/features/alchemy/shared/stores/profile-store";
import { gearPersistenceCodec } from "@/features/alchemy/shared/stores/gear-store";
import type { GearSaveFields } from "@/features/alchemy/shared/stores/gear-store-types";
import {
  runProfilePersistenceCodec,
  type RunProfileSaveFields,
} from "@/features/alchemy/shared/stores/run-save-readers";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { SaveData } from "./types";
import { readParkedRuns, readRunRecency } from "@/features/alchemy/shared/stores/run-reads";
import {
  subscribeRunSessionCommits,
  dispatchRunSessionCommand,
  type GameplayDraft,
} from "@/features/alchemy/shared/stores/run-session-command";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";

export type AlchemyPersistenceFields = SettingsSaveFields & ProfileSaveFields & GearSaveFields & RunProfileSaveFields;

export const PERSISTENCE_CODECS = [
  settingsPersistenceCodec,
  profilePersistenceCodec,
  gearPersistenceCodec,
  runProfilePersistenceCodec,
] as const;

export function createDefaultPersistenceFields(): AlchemyPersistenceFields {
  return Object.assign({}, ...PERSISTENCE_CODECS.map((c) => c.createDefault())) as AlchemyPersistenceFields;
}

export function encodePersistenceFields(): AlchemyPersistenceFields {
  return Object.assign({}, ...PERSISTENCE_CODECS.map((c) => c.encode())) as AlchemyPersistenceFields;
}

export const encodeAlchemyPersistenceFields = encodePersistenceFields;

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
  const unsubscribers = [settingsPersistenceCodec.subscribe(listener), subscribeRunSessionCommits(() => listener())];
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

export function buildAlchemySaveDataFromStores(activeRun: ActiveRunData | null): SaveData {
  const persistenceFields = encodePersistenceFields();

  const {
    saveSchemaVersion: _saveSchemaVersion,
    gameBuildVersion: _gameBuildVersion,
    contentVersion: _contentVersion,
    ...safeFields
  } = persistenceFields as AlchemyPersistenceFields & {
    saveSchemaVersion?: unknown;
    gameBuildVersion?: unknown;
    contentVersion?: unknown;
  };
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    ...safeFields,
    activeRun,
    parkedRuns: readParkedRuns(),
    runRecency: readRunRecency(),
    lastSavedAt: Date.now(),
  };
}
