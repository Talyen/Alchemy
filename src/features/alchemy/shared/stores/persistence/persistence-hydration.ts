import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import type { AlchemyPersistenceFields } from "../../storage/types";
import type { GameplayDraft } from "../session/gameplay-command";
import { gearPersistenceCodec } from "@/features/alchemy/shared/stores/persistence/gear-codec";
import { discoverUniqueIds } from "../session/profile-store";
import { profilePersistenceCodec } from "@/features/alchemy/shared/stores/persistence/profile-codec";
import { runProfilePersistenceCodec } from "./run-profile-codec";

/** Compose codec repairs inside the caller's gameplay transaction. */
export function hydrateGameplayPersistenceFields(fields: AlchemyPersistenceFields, draft: GameplayDraft): void {
  profilePersistenceCodec.hydrate(fields, draft);
  gearPersistenceCodec.hydrate(fields, draft);
  const owned = getOwnedUniqueDefinitionIds(draft.gear.inventories);
  if (owned.size > 0) discoverUniqueIds(draft, [...owned]);
  runProfilePersistenceCodec.hydrate(fields, draft);
}
