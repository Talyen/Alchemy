// Thin composition layer over store-owned persistence codecs.
import { settingsPersistenceCodec, type SettingsSaveFields } from "@/features/alchemy/shared/stores/settings-store";
import { profilePersistenceCodec, type ProfileSaveFields } from "@/features/alchemy/shared/stores/profile-store";
import { gearPersistenceCodec } from "@/features/alchemy/shared/stores/gear-store";
import type { GearSaveFields } from "@/features/alchemy/shared/stores/gear-store-types";
import {
  runProfilePersistenceCodec,
  type RunProfileSaveFields,
} from "@/features/alchemy/shared/stores/run-save-readers";

export type AlchemyPersistenceFields = SettingsSaveFields & ProfileSaveFields & GearSaveFields & RunProfileSaveFields;

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
  profilePersistenceCodec.hydrate(fields);
  gearPersistenceCodec.hydrate(fields);
  runProfilePersistenceCodec.hydrate(fields);
}

export function subscribeAlchemyPersistence(listener: () => void): () => void {
  const unsubscribers = [
    settingsPersistenceCodec.subscribe(listener),
    profilePersistenceCodec.subscribe(listener),
    gearPersistenceCodec.subscribe(listener),
    runProfilePersistenceCodec.subscribe(listener),
  ];
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
