// Public command boundary for gameplay mutations.
//
// Feature code enters the authoritative gameplay aggregate through this module.
// Each command opens one Immer produce over the committed root, runs its body
// against one explicit draft (slice actions mutate it in place), and publishes
// exactly one revision on success. A thrown body discards the draft and skips
// `afterCommit` effects.
import { produce } from "immer";
import type { Draft } from "immer";
import { subscribeGameplayCommits, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";

export type GameplayDraft = Draft<GameplayState>;

/** Bind an aggregate action as an explicit draft-first mutator. */
export function bindDraftAction<Args extends unknown[], Ret>(
  select: (state: GameplayDraft) => (...args: Args) => Ret,
): (draft: GameplayDraft, ...args: Args) => Ret {
  return (draft, ...args) => select(draft)(...args);
}

/**
 * Execute one synchronous gameplay command and publish one committed revision.
 * The recipe runs against one Immer draft. A thrown recipe discards that draft;
 * successful recipes publish one revision before `afterCommit` effects run.
 */
export function dispatchRunSessionCommand<T>(
  execute: (draft: GameplayDraft) => T,
  options?: { afterCommit?: (result: T) => void },
): T {
  let result!: T;
  const base = useGameplayStateStore.getState();
  const next = produce(base, (draft: GameplayDraft) => {
    result = execute(draft);
  });

  if (next !== base) {
    useGameplayStateStore.setState({ ...next, revision: base.revision + 1 }, true);
  }
  options?.afterCommit?.(result);
  return result;
}

/** Adapt one draft mutator into an explicit event-time command. */
export function createRunSessionCommand<Args extends unknown[], Ret>(
  mutate: (draft: GameplayDraft, ...args: Args) => Ret,
): (...args: Args) => Ret {
  return (...args) => dispatchRunSessionCommand((draft) => mutate(draft, ...args));
}

export function subscribeRunSessionCommits(listener: (revision: number) => void): () => void {
  return subscribeGameplayCommits(listener);
}

export function getRunSessionRevision(): number {
  return useGameplayStateStore.getState().revision;
}
