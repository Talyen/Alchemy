import {
  buildAlchemySaveDataFromStores,
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
  subscribeAlchemyPersistence,
  subscribeSaveCancellation,
  waitForPendingSaveWrites,
  type SaveWriteOutcome,
} from "@/features/alchemy/shared/storage";
import { readHasActiveRun, readRunPhase } from "@/features/alchemy/shared/stores/run-reads";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-lifecycle";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { logStorageFailure } from "@/lib/storage-logging";
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  AUTOSAVE_RETRY_COOLDOWN_MS,
  BATTLE_AUTOSAVE_DEBOUNCE_MS,
} from "@/lib/game-constants";
import { createAutosaveScheduler } from "./autosave-scheduler";

export interface AutosaveClock {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> | number;
  clearTimeout: (timer: ReturnType<typeof setTimeout> | number) => void;
}

export function createAlchemyAutosaveLifecycle(
  enabled: () => boolean = () => true,
  clock: AutosaveClock = { now: Date.now, setTimeout, clearTimeout },
) {
  let pendingWrite: Promise<void> = Promise.resolve();
  let timer: ReturnType<AutosaveClock["setTimeout"]> | null = null;
  const scheduler = createAutosaveScheduler(AUTOSAVE_MAX_WAIT_MS, AUTOSAVE_RETRY_COOLDOWN_MS);
  let mounted = true;

  const cancelTimer = () => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };

  const cancelPending = () => {
    cancelTimer();
    scheduler.cancel();
  };

  const schedule = () => {
    cancelTimer();
    if (!mounted || !enabled()) return;
    const now = clock.now();
    const debounceMs = isAnimationDisabled()
      ? 0
      : readRunPhase() === "battle"
        ? BATTLE_AUTOSAVE_DEBOUNCE_MS
        : AUTOSAVE_DEBOUNCE_MS;
    const delay = scheduler.nextDelay(now, debounceMs);
    if (delay === null) return;
    timer = clock.setTimeout(() => {
      timer = null;
      flush();
    }, delay);
  };

  const flush = (terminal = false) => {
    if (!enabled()) {
      cancelPending();
      return;
    }
    // Peek before building: exit events and cleanup fire with no new work,
    // and a throwing snapshot must not advance the submitted revision.
    if (!scheduler.canSubmit(terminal)) return;
    // Build before submit: a throwing snapshot must not advance the submitted
    // revision, or the scheduler would stall with no completion to recover it.
    let save;
    try {
      const activeRun = resolveActiveRunForSave(readHasActiveRun());
      save = buildAlchemySaveDataFromStores(activeRun);
    } catch (error) {
      logStorageFailure("Autosave snapshot could not be built", error);
      schedule();
      return;
    }
    const submission = scheduler.submit(terminal);
    if (!submission) return;
    cancelTimer();
    const complete = (outcome: SaveWriteOutcome) => {
      if (!mounted || !enabled()) return;
      const action = scheduler.complete(submission, outcome, clock.now());
      if (action === "cancel") cancelTimer();
      // After a partial save, keep a fresher timer set by newer changes;
      // after a failed write the stored retryAt is stale, so always reschedule.
      else if (action === "schedule" && (outcome !== "saved" || timer === null)) schedule();
    };
    const outcome = terminal ? saveAlchemySaveDataForExit(save) : saveAlchemySaveData(save);
    pendingWrite = outcome.then(complete);
  };

  const triggerSave = () => {
    if (!enabled()) return;
    scheduler.markDirty(clock.now());
    schedule();
  };

  const unsubscribeCancellation = subscribeSaveCancellation(cancelPending);
  const unsubscribePersistence = subscribeAlchemyPersistence(triggerSave);

  return {
    flush,
    async drain() {
      flush();
      await pendingWrite;
      await waitForPendingSaveWrites();
    },
    dispose(saveOnExit = true) {
      unsubscribePersistence();
      try {
        if (saveOnExit) flush(true);
      } finally {
        mounted = false;
        cancelTimer();
        unsubscribeCancellation();
      }
    },
  };
}
