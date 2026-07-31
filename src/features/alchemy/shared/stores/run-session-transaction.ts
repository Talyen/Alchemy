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
  type GameplayState,
} from "./gameplay-state-store";
import { createRunSessionStoreSnapshot, type RunSessionStoreSnapshot } from "./run-session-queries";

type RunSessionCommitListener = (revision: number) => void;

export interface RunSessionTransactionOptions<T> {
  afterCommit?: (result: T) => void;
}

export interface RunSessionCommitState {
  revision: number;
  snapshot: RunSessionStoreSnapshot;
}

let transactionDepth = 0;
let transactionFailed = false;
let transactionEffects: Array<() => void> | null = null;
let cachedRoot: GameplayState | null = null;
let cachedCommitState: RunSessionCommitState | null = null;

interface CommitStoreHook {
  <T = RunSessionCommitState>(selector?: (state: RunSessionCommitState) => T): T;
  getState: () => RunSessionCommitState;
  getInitialState: () => RunSessionCommitState;
}

function getCommitState(): RunSessionCommitState {
  const root = useGameplayStateStore.getState();
  if (root === cachedRoot && cachedCommitState) return cachedCommitState;
  cachedRoot = root;
  cachedCommitState = { revision: root.revision, snapshot: createRunSessionStoreSnapshot(root) };
  return cachedCommitState;
}

/** Compatibility read hook over the aggregate; no shadow state is stored. */
export const useRunSessionCommitStore = ((selector?: (state: RunSessionCommitState) => unknown) =>
  useGameplayStateStore(() => {
    const state = getCommitState();
    return selector ? selector(state) : state;
  })) as CommitStoreHook;

useRunSessionCommitStore.getState = getCommitState;
useRunSessionCommitStore.getInitialState = () => {
  const initial = useGameplayStateStore.getInitialState();
  return { revision: initial.revision, snapshot: createRunSessionStoreSnapshot(initial) };
};

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
  return getCommitState().revision;
}

export function getCommittedRunSessionSnapshot(): RunSessionStoreSnapshot {
  return getCommitState().snapshot;
}

// Keep the aggregate bridge eager, matching the old bootstrap behavior.
useGameplayStateStore.getState();
