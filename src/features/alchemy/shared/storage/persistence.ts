import {
  settingsPersistenceCodec,
  useSettingsStore,
  type SettingsSaveFields,
} from "@/features/alchemy/shared/stores/settings-store";
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

const GAMEPLAY_PERSISTENCE_CODECS = [
  profilePersistenceCodec,
  gearPersistenceCodec,
  runProfilePersistenceCodec,
] as const;

export const PERSISTENCE_CODECS = [settingsPersistenceCodec, ...GAMEPLAY_PERSISTENCE_CODECS] as const;

export function createDefaultPersistenceFields(): AlchemyPersistenceFields {
  return {
    ...settingsPersistenceCodec.createDefault(),
    ...profilePersistenceCodec.createDefault(),
    ...gearPersistenceCodec.createDefault(),
    ...runProfilePersistenceCodec.createDefault(),
  };
}

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
  const unsubscribers = [useSettingsStore.subscribe(listener), subscribeRunSessionCommits(() => listener())];
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

export function buildAlchemySaveDataFromStores(activeRun: ActiveRunData | null): SaveData {
  const persistenceFields = encodePersistenceFields();
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    ...persistenceFields,
    activeRun,
    parkedRuns: readParkedRuns(),
    runRecency: readRunRecency(),
    lastSavedAt: 0,
  };
}
