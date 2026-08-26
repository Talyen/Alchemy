// Thin composition layer over store-owned persistence codecs.
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
import {
  subscribeRunSessionCommits,
  dispatchRunSessionCommand,
  type GameplayDraft,
} from "@/features/alchemy/shared/stores/run-session-command";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";

export type AlchemyPersistenceFields = SettingsSaveFields & ProfileSaveFields & GearSaveFields & RunProfileSaveFields;

/** Repair: owned uniques count as discovered. May dirty the save on load when backfilling. */
function unionOwnedUniquesIntoDiscovered(draft: GameplayDraft): void {
  const owned = getOwnedUniqueDefinitionIds(draft.gear.inventories);
  if (owned.size === 0) return;
  discoverUniqueIds(draft, [...owned]);
}

export function encodeAlchemyPersistenceFields(): AlchemyPersistenceFields {
  return {
    ...settingsPersistenceCodec.encode(),
    ...profilePersistenceCodec.encode(),
    ...gearPersistenceCodec.encode(),
    ...runProfilePersistenceCodec.encode(),
  };
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
