// Single source for persistence codecs — envelope keys are derived from here.
//
// Adding a field requires only adding it to the owning codec and re-exporting.
// `defaults.ts` and `build-save-data-from-stores.ts` consume this registry so the
// three copies (types.ts / defaults.ts / SaveDataSchema) stay in sync via tests.
//
// SaveDataSchema (Zod) still declares fields explicitly because Zod needs `.catch()`
// defaults, but `tests/architecture/save-migration-guard.test.ts` asserts the key
// set matches the registry.
import { settingsPersistenceCodec } from "@/features/alchemy/shared/stores/settings-store";
import { profilePersistenceCodec } from "@/features/alchemy/shared/stores/profile-store";
import { gearPersistenceCodec } from "@/features/alchemy/shared/stores/gear-store";
import { runProfilePersistenceCodec } from "@/features/alchemy/shared/stores/run-save-readers";
import type { AlchemyPersistenceFields } from "./persistence-coordinator";

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
