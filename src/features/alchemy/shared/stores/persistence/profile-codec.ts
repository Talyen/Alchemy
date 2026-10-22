import type { GameSession } from "../session/game-session-types";
import { readGameplayState } from "../session/gameplay-state-reads";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "../session/profile-store-types";
import type { GameplayPersistenceCodec } from "./persistence-codec";

const PROFILE_SAVE_KEYS = Object.keys(createDefaultProfileSaveFields()) as Array<keyof ProfileSaveFields>;

function cloneProfileSaveFields(fields: ProfileSaveFields): ProfileSaveFields {
  // Select before cloning: collection navigation is presentation state.
  const selected = createDefaultProfileSaveFields();
  for (const key of PROFILE_SAVE_KEYS) Object.assign(selected, { [key]: fields[key] });
  return structuredClone(selected);
}

export const profilePersistenceCodec: GameplayPersistenceCodec<ProfileSaveFields> = {
  createDefault: createDefaultProfileSaveFields,
  encode: (gameSession: GameSession) => cloneProfileSaveFields(readGameplayState(gameSession).profile),
  hydrate: (fields, draft) => Object.assign(draft.profile, cloneProfileSaveFields(fields)),
};
