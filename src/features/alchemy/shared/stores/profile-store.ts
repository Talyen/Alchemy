import { appendUniqueMany } from "@/lib/utils";
import type { GameSession } from "./game-session-types";
import { readGameplayState } from "./gameplay-state-reads";
import { type GameplayPersistenceCodec } from "./persistence-codec";
import { createDefaultProfileSaveFields, type ProfileSaveFields, type ProfileStateFields } from "./profile-store-types";
import type { RunTransaction } from "./run-session-command";
import {
  setDiscoveredCardIds as setDiscoveredCardIdsInDraft,
  setDiscoveredTrinketIds as setDiscoveredTrinketIdsInDraft,
  setDiscoveredUniqueIds as setDiscoveredUniqueIdsInDraft,
} from "./run-session-write-port";

export type { ProfileSaveFields } from "./profile-store-types";

const PROFILE_SAVE_KEYS = Object.keys(createDefaultProfileSaveFields()) as Array<keyof ProfileSaveFields>;

function cloneProfileSaveFields(fields: ProfileSaveFields): ProfileSaveFields {
  // Select before cloning: collection navigation is presentation state.
  return structuredClone(Object.fromEntries(PROFILE_SAVE_KEYS.map((key) => [key, fields[key]]))) as ProfileSaveFields;
}

export const profilePersistenceCodec: GameplayPersistenceCodec<ProfileSaveFields> = {
  createDefault: createDefaultProfileSaveFields,
  encode: (gameSession: GameSession) => cloneProfileSaveFields(readGameplayState(gameSession).profile),
  hydrate: (fields, draft) => Object.assign(draft.profile, cloneProfileSaveFields(fields)),
};

export type ProfileReadView = Readonly<ProfileStateFields>;

export function readProfileStore(gameSession: GameSession): ProfileReadView {
  return readGameplayState(gameSession).profile;
}

export function discoverCardIds(draft: RunTransaction, ids: readonly string[]): void {
  if (ids.length === 0) return;
  setDiscoveredCardIdsInDraft(draft, (current) => appendUniqueMany(current, ids));
}

export function discoverTrinketIds(draft: RunTransaction, ids: readonly string[]): void {
  if (ids.length === 0) return;
  setDiscoveredTrinketIdsInDraft(draft, (current) => appendUniqueMany(current, ids));
}

export function discoverUniqueIds(draft: RunTransaction, ids: readonly string[]): void {
  if (ids.length === 0) return;
  setDiscoveredUniqueIdsInDraft(draft, (current) => appendUniqueMany(current, ids));
}
