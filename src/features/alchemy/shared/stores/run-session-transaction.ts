// Transaction boundary for the authoritative gameplay aggregate.
//
// The aggregate store owns all gameplay fields. A command mutates an Immer
// draft and publishes exactly one root revision on success; failed commands
// discard the draft without notifying React or persistence.
import {
  beginGameplayTransaction,
  commitGameplayTransaction,
  rollbackGameplayTransaction,
  subscribeGameplayCommits,
  useGameplayStateStore,
} from "./gameplay-state-store";

type RunSessionCommitListener = (revision: number) => void;

export interface RunSessionTransactionOptions<T> {
  afterCommit?: (result: T) => void;
}

let transactionDepth = 0;
let transactionFailed = false;
let transactionEffects: Array<() => void> | null = null;

/** Execute synchronous mutations as one aggregate commit. */
export function runSessionTransaction<T>(work: () => T, options: RunSessionTransactionOptions<T> = {}): T {
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
    result = work();
    if (options.afterCommit) transactionEffects?.push(() => options.afterCommit?.(result));
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

export function subscribeRunSessionCommits(listener: RunSessionCommitListener): () => void {
  return subscribeGameplayCommits(listener);
}

export function getRunSessionRevision(): number {
  return useGameplayStateStore.getState().revision;
}
