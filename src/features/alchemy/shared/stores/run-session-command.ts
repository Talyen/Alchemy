import { produce } from "immer";
import type { Draft } from "immer";
import { subscribeGameplayCommits, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import { deepFreezeInDev } from "./store-utils";

export type GameplayDraft = Draft<GameplayState>;

let inCommand = false;

export function dispatchRunSessionCommand<T>(
  execute: (draft: GameplayDraft) => T,
  options?: { afterCommit?: (result: T) => void },
): T {
  if (inCommand) {
    throw new Error("dispatchRunSessionCommand: nested command is not allowed (execute must not dispatch)");
  }
  inCommand = true;
  let result!: T;
  // eslint-disable-next-line no-useless-assignment -- committed tracks throw vs success for afterCommit
  let committed = false;
  try {
    const base = useGameplayStateStore.getState();
    const next = produce(base, (draft: GameplayDraft) => {
      result = execute(draft);
    });

    if (next !== base) {
      const published = { ...next, revision: base.revision + 1 };
      deepFreezeInDev(published);
      useGameplayStateStore.setState(published, true);
    }
    committed = true;
  } finally {
    inCommand = false;
  }
  if (committed) {
    options?.afterCommit?.(result);
  }
  return result;
}

export function createRunSessionCommand<Args extends unknown[], Ret>(
  mutate: (draft: GameplayDraft, ...args: Args) => Ret,
): (...args: Args) => Ret {
  return (...args) => dispatchRunSessionCommand((draft) => mutate(draft, ...args));
}

export function subscribeRunSessionCommits(listener: (revision: number) => void): () => void {
  return subscribeGameplayCommits(listener);
}
