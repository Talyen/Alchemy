// Public command boundary for gameplay mutations.
//
// Feature code enters the authoritative gameplay aggregate through this module.
// Keeping the transaction mechanics here preserves one synchronous commit boundary
// without coupling callers to Zustand or Immer.
import {
  beginGameplayTransaction,
  commitGameplayTransaction,
  rollbackGameplayTransaction,
  subscribeGameplayCommits,
  useGameplayStateStore,
} from "./gameplay-state-store";

let transactionDepth = 0;
let transactionFailed = false;
let transactionEffects: Array<() => void> | null = null;

/**
 * Execute one synchronous gameplay command and publish one committed revision.
 * Pass `afterCommit` for side effects (audio, navigation) that must not run on rollback.
 */
export function dispatchRunSessionCommand<T>(execute: () => T, options?: { afterCommit?: (result: T) => void }): T {
  const isOuter = transactionDepth === 0;
  if (isOuter) {
    transactionFailed = false;
    transactionEffects = [];
    beginGameplayTransaction();
  } else {
    beginGameplayTransaction();
  }
  transactionDepth += 1;

  let result!: T;
  try {
    result = execute();
    if (options?.afterCommit) transactionEffects?.push(() => options.afterCommit?.(result));
    return result;
  } catch (error) {
    transactionFailed = true;
    throw error;
  } finally {
    transactionDepth -= 1;
    if (transactionDepth > 0) {
      commitGameplayTransaction();
    } else {
      const effects = transactionEffects ?? [];
      const failed = transactionFailed;
      transactionEffects = null;
      transactionFailed = false;

      if (failed) {
        rollbackGameplayTransaction();
      } else {
        commitGameplayTransaction();
        for (const effect of effects) effect();
      }
    }
  }
}

export function subscribeRunSessionCommits(listener: (revision: number) => void): () => void {
  return subscribeGameplayCommits(listener);
}

export function getRunSessionRevision(): number {
  return useGameplayStateStore.getState().revision;
}
