import { produce } from "immer";
import type { Draft } from "immer";
import { subscribeGameplayCommits, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import { deepFreezeInDev } from "./store-utils";

export type GameplayDraft = Draft<GameplayState>;

export type SynchronousResult<T> = T extends PromiseLike<unknown> ? never : T;

let inCommand = false;

export function dispatchRunSessionCommand<T>(
  execute: (draft: GameplayDraft) => T & SynchronousResult<T>,
  options?: { afterCommit?: (result: T) => void },
): T {
  if (inCommand) {
    throw new Error("dispatchRunSessionCommand: nested command is not allowed (execute must not dispatch)");
  }
  inCommand = true;
  let result!: T;
  try {
    const base = useGameplayStateStore.getState();
    const next = produce(base, (draft: GameplayDraft) => {
      result = execute(draft);
      if (
        result !== null &&
        (typeof result === "object" || typeof result === "function") &&
        "then" in result &&
        typeof result.then === "function"
      ) {
        void Promise.resolve(result).catch(() => undefined);
        throw new Error(
          "dispatchRunSessionCommand: commands must be synchronous; move asynchronous work outside the command",
        );
      }
    });

    if (next !== base) {
      const published = { ...next, revision: base.revision + 1 };
      deepFreezeInDev(published);
      useGameplayStateStore.setState(published, true);
    }
  } finally {
    inCommand = false;
  }
  options?.afterCommit?.(result);
  return result;
}

export function createRunSessionCommand<Args extends unknown[], Ret>(
  mutate: (draft: GameplayDraft, ...args: Args) => Ret & SynchronousResult<Ret>,
): (...args: Args) => Ret {
  return (...args) => dispatchRunSessionCommand<Ret>((draft) => mutate(draft, ...args));
}

export function subscribeRunSessionCommits(listener: (revision: number) => void): () => void {
  return subscribeGameplayCommits(listener);
}
