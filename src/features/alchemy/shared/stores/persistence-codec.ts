export interface PersistenceCodec<TSaveFields, THydrateArgs extends unknown[] = []> {
  createDefault: () => TSaveFields;
  encode: () => TSaveFields;
  hydrate: (fields: TSaveFields, ...args: THydrateArgs) => void;
}

export type GameplayPersistenceCodec<TSaveFields> = PersistenceCodec<
  TSaveFields,
  [import("./run-session-command").GameplayDraft]
>;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments -- explicit [] documents standalone has no hydrate args
export type StandalonePersistenceCodec<TSaveFields> = PersistenceCodec<TSaveFields, []>;
