import { gameplayPersistedInputsEqual } from "./persistence-commit-filter";
import type { Draft } from "immer";
import { produce } from "immer";
import type { CommandOutcome, SynchronousResult } from "./command-outcome";
import type { GameSession } from "./game-session-types";
import type { GameplayState } from "./gameplay-state";
import { subscribeGameplayCommits } from "./gameplay-state-store";
import { sessionRuntime, type SessionRuntime } from "./session-runtime";
import { deepFreezeInDev } from "./store-utils";

export type GameplayDraft = Draft<GameplayState>;

const draftRuntimes = new WeakMap<object, SessionRuntime>();
export function gameplayDraftRuntime(draft: GameplayDraft): SessionRuntime {
  const runtime = draftRuntimes.get(draft);
  if (!runtime) throw new Error("Gameplay input requires an open command draft");
  return runtime;
}

function assertSynchronousResult(result: unknown): void {
  if (
    result !== null &&
    (typeof result === "object" || typeof result === "function") &&
    "then" in result &&
    typeof result.then === "function"
  ) {
    void Promise.resolve(result).catch(() => undefined);
    throw new Error(
      "dispatchGameplayCommand: commands must be synchronous; move asynchronous work outside the command",
    );
  }
}

export function dispatchGameplayCommand<T>(
  execute: (draft: GameplayDraft) => CommandOutcome<T> & { value: SynchronousResult<T> },
  options: { afterCommit?: (result: T) => void } | undefined,
  gameSession: GameSession,
): T {
  const runtime = sessionRuntime(gameSession);
  if (runtime.inCommand) {
    throw new Error("dispatchGameplayCommand: nested command is not allowed (execute must not dispatch)");
  }
  runtime.inCommand = true;
  let outcome!: CommandOutcome<T>;
  try {
    const base = runtime.gameplay.getState();
    const next = produce(base, (draft: GameplayDraft) => {
      draftRuntimes.set(draft, runtime);
      try {
        outcome = execute(draft);
      } finally {
        draftRuntimes.delete(draft);
      }
      assertSynchronousResult(outcome);
      if (!outcome || (outcome.kind !== "accepted" && outcome.kind !== "rejected") || !("value" in outcome)) {
        throw new Error("dispatchGameplayCommand: commands must return an explicit accepted or rejected outcome");
      }
      assertSynchronousResult(outcome.value);
    });

    if (outcome.kind === "accepted" && next !== base) {
      const published = { ...next, revision: base.revision + 1 };
      deepFreezeInDev(published);
      if (runtime.progressCompletion.active && !gameplayPersistedInputsEqual(base, published)) {
        if (runtime.progressCompletion.read().kind === "idle") runtime.presentationBase = base;
        runtime.progressCompletion.mark(published.revision);
      }
      runtime.gameplay.setState(published, true);
    }
  } finally {
    runtime.inCommand = false;
  }
  if (outcome.kind === "accepted") options?.afterCommit?.(outcome.value);
  return outcome.value;
}

export function createGameplayCommand<Args extends unknown[], Ret>(
  mutate: (draft: GameplayDraft, ...args: Args) => CommandOutcome<Ret> & { value: SynchronousResult<Ret> },
  options: { afterCommit?: (result: Ret) => void } | undefined,
  gameSession: GameSession,
): (...args: Args) => Ret {
  return (...args) => dispatchGameplayCommand<Ret>((draft) => mutate(draft, ...args), options, gameSession);
}

export function subscribeRunSessionCommits(listener: (revision: number) => void, gameSession: GameSession): () => void {
  return subscribeGameplayCommits(listener, gameSession);
}

export { acceptCommand, rejectCommand } from "./command-outcome";
export type { CommandOutcome, SynchronousResult } from "./command-outcome";
