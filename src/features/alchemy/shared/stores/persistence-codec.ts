export interface PersistenceCodec<TSaveFields, THydrateArgs extends unknown[] = []> {
  createDefault: () => TSaveFields;
  encode: () => TSaveFields;
  hydrate: (fields: TSaveFields, ...args: THydrateArgs) => void;
  subscribe: (listener: () => void) => () => void;
}

export type GameplayPersistenceCodec<TSaveFields> = PersistenceCodec<
  TSaveFields,
  [import("./run-session-command").GameplayDraft]
>;

export type StandalonePersistenceCodec<TSaveFields> = PersistenceCodec<TSaveFields, []>;
