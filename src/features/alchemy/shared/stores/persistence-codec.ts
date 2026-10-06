export interface PersistenceCodec<TSaveFields, THydrateArgs extends unknown[] = []> {
  createDefault: () => TSaveFields;
  encode: () => TSaveFields;
  hydrate: (fields: TSaveFields, ...args: THydrateArgs) => void;
}

export interface GameplayPersistenceCodec<TSaveFields> extends Omit<
  PersistenceCodec<TSaveFields, [import("./gameplay-command").GameplayDraft]>,
  "encode"
> {
  encode: (gameSession: import("./game-session-types").GameSession) => TSaveFields;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments -- explicit [] documents standalone has no hydrate args
export type StandalonePersistenceCodec<TSaveFields> = PersistenceCodec<TSaveFields, []>;
