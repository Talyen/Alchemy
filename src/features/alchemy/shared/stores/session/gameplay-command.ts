import { gameplayPersistedInputsEqual } from "../persistence/persistence-commit-filter";
import type { Draft } from "immer";
import { produce } from "immer";
import { assertSynchronousResult, type CommandOutcome, type SynchronousResult } from "../commands/command-outcome";
import type { GameSession } from "./game-session-types";
import type { GameplayState } from "./gameplay-state";
import { subscribeGameplayCommits } from "./gameplay-state-reads";
import { sessionRuntime, type SessionRuntime } from "./session-runtime";
import { snapshotCommandResult } from "./readonly-view";
import type { SettingsSaveFields } from "./settings-state";

export type GameplayDraft = Draft<GameplayState>;

interface GameplayCommandOptions<T> {
  afterCommit?: (result: T) => void;
  // Store-owned hydration only. Prepare settings before execution; install
  // them and replace save receipts only after the command has succeeded.
  restore?: { settings?: SettingsSaveFields };
}

interface GameplayCommandScope {
  runtime: SessionRuntime;
  failure?: { error: unknown };
}

const draftScopes = new WeakMap<object, GameplayCommandScope>();
function gameplayDraftScope(draft: GameplayDraft): GameplayCommandScope {
  const scope = draftScopes.get(draft);
  if (!scope) throw new Error("Gameplay input requires an open command draft");
  return scope;
}

export function gameplayDraftRuntime(draft: GameplayDraft): SessionRuntime {
  return gameplayDraftScope(draft).runtime;
}

/** A failed coupled mutation cannot be accepted by catching its error in the outer recipe. */
export function abortGameplayCommand(draft: GameplayDraft, error: unknown): never {
  const scope = gameplayDraftScope(draft);
  scope.failure ??= { error };
  throw error;
}

/** Bind executable dependencies to this draft, rather than merely to its session. */
export function bindDraftCapability<Args extends unknown[], Result>(
  draft: GameplayDraft,
  execute: (...args: Args) => Result,
): (...args: Args) => Result {
  gameplayDraftRuntime(draft);
  return (...args) => {
    gameplayDraftRuntime(draft);
    return execute(...args);
  };
}

export function dispatchGameplayCommand<T>(
  execute: (draft: GameplayDraft) => CommandOutcome<T> & { value: SynchronousResult<T> },
  options: GameplayCommandOptions<T> | undefined,
  gameSession: GameSession,
): T {
  const runtime = sessionRuntime(gameSession);
  if (runtime.inCommand) {
    throw new Error("dispatchGameplayCommand: nested command is not allowed (execute must not dispatch)");
  }
  runtime.inCommand = true;
  let outcome!: CommandOutcome<T>;
  try {
    const base = runtime.gameplay.reads.getState();
    const hydrateSettings = options?.restore?.settings
      ? runtime.settingsCodec.prepareHydration(options.restore.settings)
      : undefined;
    const next = produce(base, (draft: GameplayDraft) => {
      const scope: GameplayCommandScope = { runtime };
      draftScopes.set(draft, scope);
      try {
        outcome = execute(draft);
        if (scope.failure) throw scope.failure.error;
      } finally {
        draftScopes.delete(draft);
      }
      assertSynchronousResult(outcome);
      if (!outcome || (outcome.kind !== "accepted" && outcome.kind !== "rejected") || !("value" in outcome)) {
        throw new Error("dispatchGameplayCommand: commands must return an explicit accepted or rejected outcome");
      }
      // Results cross the same lifetime boundary for store and feature commands.
      // Detach before Immer revokes drafts, including rejected fallback values.
      outcome = { ...outcome, value: snapshotCommandResult(outcome.value) as T };
    });

    if (outcome.kind === "accepted") {
      const published = next === base ? base : { ...next, revision: base.revision + 1 };
      const progress = runtime.progressCompletion;
      const persistedChange =
        (progress.hasRetryDriver || progress.read().kind !== "idle") && !gameplayPersistedInputsEqual(base, published);
      const prepareProgress = () => {
        const progress = runtime.progressCompletion;
        if (options?.restore) {
          const pending = progress.hasRetryDriver || progress.read().kind !== "idle";
          if (pending && progress.read().kind === "idle") runtime.presentationBase = base;
          progress.replace(pending ? published.revision : undefined);
        } else if (persistedChange) {
          if (progress.read().kind === "idle") runtime.presentationBase = base;
          progress.mark(published.revision);
        }
      };
      const prepareObservers = () => {
        if (hydrateSettings) hydrateSettings(prepareProgress);
        else prepareProgress();
      };
      if (published !== base || options?.restore) runtime.gameplay.commit(published, prepareObservers);
    }
  } finally {
    runtime.inCommand = false;
  }
  // Publication observers may close this session. Committed data survives,
  // but a closed owner cannot start new presentation or follow-up commands.
  if (outcome.kind === "accepted" && runtime.lifetime.isActive()) options?.afterCommit?.(outcome.value);
  return outcome.value;
}

export function createGameplayCommand<Args extends unknown[], Ret>(
  mutate: (draft: GameplayDraft, ...args: Args) => CommandOutcome<Ret> & { value: SynchronousResult<Ret> },
  options: GameplayCommandOptions<Ret> | undefined,
  gameSession: GameSession,
): (...args: Args) => Ret {
  return (...args) => dispatchGameplayCommand<Ret>((draft) => mutate(draft, ...args), options, gameSession);
}

export function subscribeRunSessionCommits(listener: (revision: number) => void, gameSession: GameSession) {
  return subscribeGameplayCommits(listener, gameSession);
}

export { acceptCommand, rejectCommand } from "../commands/command-outcome";
export type { CommandOutcome, SynchronousResult } from "../commands/command-outcome";
