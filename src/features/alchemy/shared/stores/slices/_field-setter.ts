export type ImmerSet<State> = (fn: (state: State) => void) => void;

/**
 * Creates a higher-order setter for fields on a state or nested slice.
 * If `getSlice` is omitted, operates directly on the target state.
 */
export function defineFieldSetter<State, SliceState = State>(
  set: ImmerSet<State>,
  getSlice: (state: State) => SliceState = (state) => state as unknown as SliceState,
) {
  return <K extends keyof SliceState>(field: K) =>
    (action: SliceState[K] | ((prev: SliceState[K]) => SliceState[K])) =>
      set((draft) => {
        const slice = getSlice(draft);
        const prev = slice[field];
        slice[field] = typeof action === "function" ? (action as (prev: SliceState[K]) => SliceState[K])(prev) : action;
      });
}
