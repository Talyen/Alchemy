export interface PersistenceCodec<TSaveFields, THydrateArgs extends unknown[] = []> {
  createDefault: () => TSaveFields;
  encode: () => TSaveFields;
  hydrate: (fields: TSaveFields, ...args: THydrateArgs) => void;
}

export interface GameplayPersistenceCodec<TSaveFields> extends Omit<
  PersistenceCodec<TSaveFields, [import("../session/gameplay-command").GameplayDraft]>,
  "encode"
> {
  encode: (gameSession: import("../session/game-session-types").GameSession) => TSaveFields;
}

// oxlint-disable-next-line typescript/no-unnecessary-type-arguments -- explicit [] documents standalone has no hydrate args
export type StandalonePersistenceCodec<TSaveFields> = PersistenceCodec<TSaveFields, []>;
