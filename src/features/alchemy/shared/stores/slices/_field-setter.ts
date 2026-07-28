export type ImmerSet<State> = (fn: (state: State) => void) => void;

export function defineFieldSetter<SliceState, State>(set: ImmerSet<State>, sliceKey: keyof State & string) {
  return <K extends keyof SliceState>(field: K) =>
    (action: SliceState[K] | ((prev: SliceState[K]) => SliceState[K])) =>
      set((draft) => {
        const slice = (draft as Record<string, unknown>)[sliceKey] as Record<string, unknown>;
        slice[field as string] =
          typeof action === "function"
            ? (action as (prev: SliceState[K]) => SliceState[K])(slice[field as string] as SliceState[K])
            : action;
      });
}

/** Field setter for a nested domain object. */
export function defineNestedFieldSetter<SliceState, State>(
  set: ImmerSet<State>,
  getSlice: (state: State) => SliceState,
) {
  return <K extends keyof SliceState & string>(field: K) =>
    (action: SliceState[K] | ((prev: SliceState[K]) => SliceState[K])) =>
      set((draft) => {
        const slice = getSlice(draft) as Record<string, unknown>;
        slice[field] =
          typeof action === "function"
            ? (action as (prev: SliceState[K]) => SliceState[K])(slice[field] as SliceState[K])
            : action;
      });
}
