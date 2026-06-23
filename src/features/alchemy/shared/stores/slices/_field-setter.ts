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
