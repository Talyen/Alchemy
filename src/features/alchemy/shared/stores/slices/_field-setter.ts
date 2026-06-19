type ImmerSet = (fn: (state: any) => void) => void;

export function defineFieldSetter<SliceState>(set: ImmerSet, sliceKey: string) {
  return <K extends keyof SliceState>(field: K) =>
    (action: SliceState[K] | ((prev: SliceState[K]) => SliceState[K])) =>
      set((draft: any) => {
        draft[sliceKey][field] =
          typeof action === "function"
            ? (action as (prev: SliceState[K]) => SliceState[K])(draft[sliceKey][field])
            : action;
      });
}
