// Transaction boundary for the run session's lifetime-matched stores.
//
// The run domain, transient session, battle, permanent profile, and gear stores
// remain separate mutation owners, but React and autosave read one committed
// session projection. Gameplay operations must publish one committed session
// change; settings and presentation-only state remain outside this boundary.
import { create } from "zustand";
import { useRunBattleDomainStore } from "./run-battle-domain-store";
import { useRunDomainStore } from "./run-domain-store";
import { useRunProfileStore } from "./run-profile-store";
import { useRunTransientStore } from "./run-transient-store";
import { useProfileStore } from "./profile-store";
import { useGearStore } from "./gear-store";

type RunSessionCommitListener = (revision: number) => void;
export interface RunSessionTransactionOptions<T> {
  /** Run after the outer transaction commits; discarded when any nested work fails. */
  afterCommit?: (result: T) => void;
}

let subscriptionsInstalled = false;
let transactionDepth = 0;
let transactionDirty = false;
let transactionFailed = false;
let restoringSnapshot = false;
let revision = 0;
const listeners = new Set<RunSessionCommitListener>();
let transactionEffects: Array<() => void> | null = null;

export interface RunSessionStoreSnapshot {
  domain: ReturnType<typeof useRunDomainStore.getState>;
  transient: ReturnType<typeof useRunTransientStore.getState>;
  battle: ReturnType<typeof useRunBattleDomainStore.getState>;
  runProfile: ReturnType<typeof useRunProfileStore.getState>;
  profile: ReturnType<typeof useProfileStore.getState>;
  gear: ReturnType<typeof useGearStore.getState>;
}

let transactionSnapshot: RunSessionStoreSnapshot | null = null;

interface RunSessionCommitState {
  revision: number;
  snapshot: RunSessionStoreSnapshot;
}

/**
 * The only React-facing gameplay snapshot.
 *
 * The lifetime-matched stores remain as mutation owners for now, but screens
 * subscribe to this committed projection instead of subscribing to each store
 * independently. A transaction can therefore update its private stores in any
 * order without exposing a mixed revision to React readers.
 */
export const useRunSessionCommitStore = create<RunSessionCommitState>()(() => ({
  revision: 0,
  snapshot: captureSnapshot(),
}));

function publishCommit(): void {
  revision += 1;
  useRunSessionCommitStore.setState({ revision, snapshot: captureSnapshot() }, true);
  for (const listener of listeners) listener(revision);
}

function handleStoreMutation(): void {
  if (restoringSnapshot) return;
  if (transactionDepth > 0) {
    transactionDirty = true;
    return;
  }
  publishCommit();
}

function ensureSubscriptions(): void {
  if (subscriptionsInstalled) return;
  subscriptionsInstalled = true;
  useRunDomainStore.subscribe(handleStoreMutation);
  useRunTransientStore.subscribe(handleStoreMutation);
  useRunBattleDomainStore.subscribe(handleStoreMutation);
  useRunProfileStore.subscribe(handleStoreMutation);
  if (typeof useProfileStore.subscribe === "function") useProfileStore.subscribe(handleStoreMutation);
  if (typeof useGearStore.subscribe === "function") useGearStore.subscribe(handleStoreMutation);
}

function captureSnapshot(): RunSessionStoreSnapshot {
  return {
    domain: useRunDomainStore.getState(),
    transient: useRunTransientStore.getState(),
    battle: useRunBattleDomainStore.getState(),
    runProfile: useRunProfileStore.getState(),
    profile: useProfileStore.getState(),
    gear: useGearStore.getState(),
  };
}

function restoreSnapshot(snapshot: RunSessionStoreSnapshot): void {
  restoringSnapshot = true;
  try {
    useRunDomainStore.setState(snapshot.domain, true);
    useRunTransientStore.setState(snapshot.transient, true);
    useRunBattleDomainStore.setState(snapshot.battle, true);
    useRunProfileStore.setState(snapshot.runProfile, true);
    useProfileStore.setState(snapshot.profile, true);
    useGearStore.setState(snapshot.gear, true);
  } finally {
    restoringSnapshot = false;
  }
}

/** Execute synchronous mutations as one committed run-session change. */
export function runSessionTransaction<T>(work: () => T, options: RunSessionTransactionOptions<T> = {}): T {
  ensureSubscriptions();
  const isOuterTransaction = transactionDepth === 0;
  if (isOuterTransaction) {
    transactionSnapshot = captureSnapshot();
    transactionFailed = false;
    transactionDirty = false;
    transactionEffects = [];
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
    if (transactionDepth === 0) {
      const snapshot = transactionSnapshot;
      const failed = transactionFailed;
      const effects = transactionEffects ?? [];
      transactionSnapshot = null;
      transactionFailed = false;
      transactionEffects = null;

      if (failed) {
        if (snapshot) restoreSnapshot(snapshot);
        transactionDirty = false;
      } else if (transactionDirty) {
        transactionDirty = false;
        publishCommit();
      }

      if (!failed) {
        for (const effect of effects) effect();
      }
    }
  }
}

/** Subscribe to committed run-session changes and receive a monotonic revision. */
export function subscribeRunSessionCommits(listener: RunSessionCommitListener): () => void {
  ensureSubscriptions();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current committed run-session revision, useful for diagnostics and tests. */
export function getRunSessionRevision(): number {
  ensureSubscriptions();
  return revision;
}

/** Read the last committed gameplay snapshot for imperative persistence/readers. */
export function getCommittedRunSessionSnapshot(): RunSessionStoreSnapshot {
  ensureSubscriptions();
  return useRunSessionCommitStore.getState().snapshot;
}

// Install the bridge eagerly so direct store mutations are never missed before
// the first transaction or persistence subscription is created.
ensureSubscriptions();
