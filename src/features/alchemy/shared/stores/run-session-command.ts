// Public command boundary for gameplay mutations.
//
// Feature code enters the authoritative gameplay aggregate through this module.
// Keeping the transaction mechanics here preserves one synchronous commit boundary
// without coupling callers to Zustand or Immer. The nesting depth and draft live in
// the store; this module owns only the per-transaction failure flag and deferred
// `afterCommit` effects.
import {
  beginGameplayTransaction,
  commitGameplayTransaction,
  subscribeGameplayCommits,
  useGameplayStateStore,
} from "./gameplay-state-store";

let transactionFailed = false;
let transactionEffects: Array<() => void> | null = null;

/**
 * Execute one synchronous gameplay command and publish one committed revision.
 * Pass `afterCommit` for side effects (audio, navigation) that must not run on rollback.
 */
export function dispatchRunSessionCommand<T>(execute: () => T, options?: { afterCommit?: (result: T) => void }): T {
  const isOuter = beginGameplayTransaction();
  if (isOuter) {
    transactionFailed = false;
    transactionEffects = [];
  }

  let result!: T;
  try {
    result = execute();
    if (options?.afterCommit) transactionEffects?.push(() => options.afterCommit?.(result));
    return result;
  } catch (error) {
    transactionFailed = true;
    throw error;
  } finally {
    const effects = transactionEffects ?? [];
    const failed = transactionFailed;
    const finalized = commitGameplayTransaction(!failed);
    if (finalized) {
      transactionEffects = null;
      transactionFailed = false;
      if (!failed) for (const effect of effects) effect();
    }
  }
}

export function subscribeRunSessionCommits(listener: (revision: number) => void): () => void {
  return subscribeGameplayCommits(listener);
}

export function getRunSessionRevision(): number {
  return useGameplayStateStore.getState().revision;
}
