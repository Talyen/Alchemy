import type { GameplayDraft } from "./run-session-command";

// Store-owned boundary for translating a domain's runtime state to and from save fields.
export interface PersistenceCodec<TSaveFields> {
  createDefault: () => TSaveFields;
  encode: () => TSaveFields;
  hydrate: (fields: TSaveFields, draft?: GameplayDraft) => void;
  subscribe: (listener: () => void) => () => void;
}
