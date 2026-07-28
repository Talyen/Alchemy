// Store-owned boundary for translating a domain's runtime state to and from save fields.
export interface PersistenceCodec<TSaveFields> {
  createDefault: () => TSaveFields;
  encode: () => TSaveFields;
  hydrate: (fields: TSaveFields) => void;
  subscribe: (listener: () => void) => () => void;
}
