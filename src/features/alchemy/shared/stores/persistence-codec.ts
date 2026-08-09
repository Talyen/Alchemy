// Store-owned boundary for translating a domain's runtime state to and from save fields.
export interface PersistenceCodec<TSaveFields, THydrateArgs extends unknown[] = []> {
  createDefault: () => TSaveFields;
  encode: () => TSaveFields;
  hydrate: (fields: TSaveFields, ...args: THydrateArgs) => void;
  subscribe: (listener: () => void) => () => void;
}
