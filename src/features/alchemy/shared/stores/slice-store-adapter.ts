import {
  applyGameplayStateUpdate,
  readGameplayState,
  useGameplayStateStore,
  type GameplayState,
} from "./gameplay-state-store";

export interface SliceStore<T> {
  <U = T>(selector?: (state: T) => U): U;
  getState: () => T;
  getInitialState: () => T;
  setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T> | void), replace?: boolean) => void;
  subscribe: (listener: (state: T, previousState: T) => void) => () => void;
}

type SliceSetter<T> = (state: GameplayState, key: keyof T, value: unknown) => void;

export function createSliceStore<T extends object>(
  pick: (state: GameplayState) => T,
  keys: ReadonlyArray<keyof T>,
  keyMap: Partial<Record<keyof T, keyof GameplayState>> = {},
  writeKey?: SliceSetter<T>,
): SliceStore<T> {
  const useSlice = ((selector?: (state: T) => unknown) =>
    useGameplayStateStore((state) => {
      const slice = pick(state);
      return selector ? selector(slice) : slice;
    })) as SliceStore<T>;

  useSlice.getState = () => pick(readGameplayState());
  useSlice.getInitialState = () => pick(useGameplayStateStore.getInitialState());
  useSlice.setState = (partial, replace = false) => {
    void replace;
    applyGameplayStateUpdate((state) => {
      const slice = pick(state);
      const next =
        typeof partial === "function"
          ? (() => {
              const draft = { ...slice };
              const returned = partial(draft);
              if (returned && typeof returned === "object" && returned !== draft) Object.assign(draft, returned);
              return draft;
            })()
          : partial;
      if (!next || typeof next !== "object") return;
      for (const key of keys) {
        if (!(key in (next as object))) continue;
        if (writeKey) {
          writeKey(state, key, (next as T)[key]);
          continue;
        }
        const rootKey = (keyMap[key] ?? key) as keyof GameplayState;
        (state[rootKey] as unknown) = (next as T)[key];
      }
    });
  };
  useSlice.subscribe = (listener) =>
    useGameplayStateStore.subscribe((state, previousState) => listener(pick(state), pick(previousState)));
  return useSlice;
}
