import { createSessionPersistence, type SaveWriteOutcome } from "@/features/alchemy/shared/storage";
import type { GameSession, SessionClock } from "@/features/alchemy/shared/stores/game-session-types";
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
import { TimerGroup } from "@/lib/animation/game-timer";
import { createAutosaveScheduler } from "./autosave-scheduler";

export type AutosaveClock = SessionClock;

export function createAlchemyAutosaveLifecycle(
  enabled: () => boolean = () => true,
  clock: AutosaveClock | undefined,
  gameSession: GameSession,
) {
  const persistence = createSessionPersistence(gameSession);
  const runtimeClock = clock ?? sessionClock(gameSession);
  const timers = new TimerGroup(runtimeClock);
  let pendingWrite: Promise<void> = Promise.resolve();
  let cancelScheduledSave: (() => void) | null = null;
  const scheduler = createAutosaveScheduler(AUTOSAVE_MAX_WAIT_MS, AUTOSAVE_RETRY_COOLDOWN_MS);
  let mounted = true;

  const cancelTimer = () => {
    cancelScheduledSave?.();
    cancelScheduledSave = null;
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
    cancelScheduledSave = timers.setTimeout(() => {
      cancelScheduledSave = null;
      flush();
    }, delay);
  };

  const flush = (terminal = false) => {
    if (!mounted) return;
    if (!enabled()) {
      cancelPending();
      return;
    }
    // Check before snapshotting: clean exit events do no work. Build before
    // submission so a snapshot failure cannot leave a revision waiting for a write.
    if (!scheduler.canSubmit(terminal)) return;
    let save;
    try {
      save = persistence.snapshot();
    } catch (error) {
      logStorageFailure("Autosave snapshot could not be built", error);
      scheduler.failSnapshot(runtimeClock.now(), terminal);
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
      // after failure the existing timer may predate the cooldown, so reschedule.
      else if (action === "schedule" && (outcome !== "saved" || cancelScheduledSave === null)) schedule();
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
