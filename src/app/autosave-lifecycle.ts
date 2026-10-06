import { createSessionPersistence, type SaveWriteOutcome } from "@/features/alchemy/shared/storage";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readRunPhase } from "@/features/alchemy/shared/stores/run-reads";
import { registerSessionCleanup, sessionClock } from "@/features/alchemy/shared/stores/session-capabilities";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  AUTOSAVE_RETRY_COOLDOWN_MS,
  BATTLE_AUTOSAVE_DEBOUNCE_MS,
} from "@/lib/game-constants";
import { logStorageFailure } from "@/lib/storage-logging";
import { createAutosaveScheduler } from "./autosave-scheduler";

export interface AutosaveClock {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> | number;
  clearTimeout: (timer: ReturnType<typeof setTimeout> | number) => void;
}

export function createAlchemyAutosaveLifecycle(
  enabled: () => boolean = () => true,
  clock: AutosaveClock | undefined,
  gameSession: GameSession,
) {
  const persistence = createSessionPersistence(gameSession);
  const runtimeClock = clock ?? sessionClock(gameSession);
  let pendingWrite: Promise<void> = Promise.resolve();
  let timer: ReturnType<AutosaveClock["setTimeout"]> | null = null;
  const scheduler = createAutosaveScheduler(AUTOSAVE_MAX_WAIT_MS, AUTOSAVE_RETRY_COOLDOWN_MS);
  let mounted = true;

  const cancelTimer = () => {
    if (timer !== null) runtimeClock.clearTimeout(timer);
    timer = null;
  };

  const cancelPending = () => {
    cancelTimer();
    scheduler.cancel();
  };

  const schedule = () => {
    cancelTimer();
    if (!mounted || !enabled()) return;
    const now = runtimeClock.now();
    const debounceMs = isAnimationDisabled()
      ? 0
      : readRunPhase(gameSession) === "battle"
        ? BATTLE_AUTOSAVE_DEBOUNCE_MS
        : AUTOSAVE_DEBOUNCE_MS;
    const delay = scheduler.nextDelay(now, debounceMs);
    if (delay === null) return;
    timer = runtimeClock.setTimeout(() => {
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
      save = persistence.snapshot();
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
      const action = scheduler.complete(submission, outcome, runtimeClock.now());
      if (action === "cancel") cancelTimer();
      // After a partial save, keep a fresher timer set by newer changes;
      // after a failed write the stored retryAt is stale, so always reschedule.
      else if (action === "schedule" && (outcome !== "saved" || timer === null)) schedule();
    };
    const outcome = terminal ? persistence.writeOnExit(save) : persistence.write(save);
    pendingWrite = outcome.then(complete);
  };

  const triggerSave = () => {
    if (!enabled()) return;
    scheduler.markDirty(runtimeClock.now());
    schedule();
  };

  const unsubscribeCancellation = persistence.subscribeCancellation(cancelPending);
  const unsubscribePersistence = persistence.subscribe(triggerSave);

  const dispose = (saveOnExit = true) => {
    unsubscribePersistence();
    try {
      if (saveOnExit) flush(true);
    } finally {
      mounted = false;
      cancelTimer();
      unsubscribeCancellation();
    }
  };
  const release = registerSessionCleanup(gameSession, () => dispose(false));
  return {
    flush,
    async drain() {
      flush();
      await pendingWrite;
      await persistence.waitForWrites();
    },
    dispose(saveOnExit = true) {
      dispose(saveOnExit);
      release();
    },
  };
}
