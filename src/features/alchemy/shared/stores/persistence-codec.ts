export interface PersistenceCodec<TSaveFields, THydrateArgs extends unknown[] = []> {
  createDefault: () => TSaveFields;
  encode: (gameSession?: import("./game-session-types").GameSession) => TSaveFields;
  hydrate: (fields: TSaveFields, ...args: THydrateArgs) => void;
}

export type GameplayPersistenceCodec<TSaveFields> = PersistenceCodec<
  TSaveFields,
  [import("./gameplay-command").GameplayDraft]
>;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments -- explicit [] documents standalone has no hydrate args
export type StandalonePersistenceCodec<TSaveFields> = PersistenceCodec<TSaveFields, []>;
