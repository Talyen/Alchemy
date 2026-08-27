// Public command boundary for gameplay mutations.
//
// Feature code enters the authoritative gameplay aggregate through this module.
// Each command opens one Immer produce over the committed root, runs its body
// against one explicit draft (slice actions mutate it in place), and publishes
// exactly one revision on success. A thrown body discards the draft and skips
// `afterCommit` effects.
//
// `afterCommit` is intentionally a side-effect layer (audio, save flush,
// analytics) that runs *after* the Immer commit and revision bump but still
// synchronously in the command. It is not a second draft mutation — the
// pattern is: draft mutate → produce → setState(revision++) → afterCommit(result).
// Callers like `flushSaveAfterRunEnd` use it so persistence/audio observe the
// committed revision without nesting another produce. Extracting it into the
// draft body would intermix pure state writes with I/O; keeping it outside
// preserves the one-produce-per-command invariant.
import { produce } from "immer";
import type { Draft } from "immer";
import { subscribeGameplayCommits, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";

export type GameplayDraft = Draft<GameplayState>;

/**
 * Execute one synchronous gameplay command and publish one committed revision.
 * The recipe runs against one Immer draft. A thrown recipe discards that draft
 * and skips `afterCommit`. Successful recipes run `afterCommit` after produce
 * completes: mutations publish one revision first; no-op recipes still run
 * `afterCommit` without a new revision. `afterCommit` is for side-effects
 * (e.g. `flushSaveAfterRunEnd`, audio) and intentionally lives outside the
 * draft — see module header.
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
