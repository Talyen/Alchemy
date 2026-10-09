import type { SaveWriteOutcome } from "@/features/alchemy/shared/storage";
import { clamp } from "@/lib/math";

type AutosaveCompletionAction = "ignore" | "cancel" | "schedule";

interface SaveSubmission {
  readonly revision: number;
  readonly schedulerEpoch: number;
}

/** Owns one subscription lifetime. The adapter supplies clocks, timers, and storage.
 *
 * schedulerEpoch guards hook-lifetime invalidation (cancel on unmount or
 * disable must ignore late completions). SaveWriteQueue.storageEpoch guards
 * storage invalidation (clear or write protection must skip stale writes).
 * Both are required: the queue cannot repair scheduler revision counters from
 * a "skipped" outcome alone once the scheduler has reset, and a clear with no
 * pending write still needs the cancellation broadcast to drop a
 * debounced-but-unsubmitted dirty revision (see save-write-queue.ts). */
export function createAutosaveScheduler(maxWaitMs: number, retryCooldownMs: number = maxWaitMs) {
  let revision = 0;
  let acknowledgedRevision = 0;
  let submittedRevision = 0;
  let schedulerEpoch = 0;
  let exitAttemptedRevision = 0;
  let dirtySince = 0;
  let retryAt = 0;
  let retryRevision = 0;

  function cancel() {
    schedulerEpoch++;
    revision = acknowledgedRevision = submittedRevision = retryRevision = exitAttemptedRevision = 0;
    dirtySince = retryAt = 0;
  }

  function canSubmit(terminal: boolean): boolean {
    // Peek without mutating so callers can skip snapshot work when idle.
    // Exit-once latch: back-to-back pagehide/beforeunload/visibilitychange for
    // the same revision submit once; the next markDirty moves revision forward.
    if (terminal && revision === exitAttemptedRevision) return false;
    return revision > acknowledgedRevision && (terminal || revision > submittedRevision);
  }

  return {
    cancel,
    canSubmit,
    retryNow() {
      submittedRevision = acknowledgedRevision;
      exitAttemptedRevision = 0;
      retryAt = 0;
    },
    markDirty(now: number) {
      // Preserve the original max-wait window across failure rewinds and partial
      // saves: only a fully submitted revision restarts the dirty-since clock.
      if (revision === submittedRevision) dirtySince = now;
      revision++;
    },
    nextDelay(now: number, debounceMs: number): number | null {
      if (!canSubmit(false)) return null;
      const maxWaitDelay = maxWaitMs - (now - dirtySince);
      // New changes and shorter debounces cannot bypass a failure cooldown.
      return Math.max(retryAt - now, clamp(maxWaitDelay, 0, debounceMs));
    },
    failSnapshot(now: number, terminal: boolean) {
      // No write was submitted; retain dirty progress while sharing the
      // failure cooldown and the one-attempt-per-revision exit latch.
      retryAt = now + retryCooldownMs;
      retryRevision = revision;
      if (terminal) exitAttemptedRevision = revision;
    },
    submit(terminal: boolean): SaveSubmission | null {
      if (!canSubmit(terminal)) {
        return null;
      }
      submittedRevision = revision;
      if (terminal) exitAttemptedRevision = revision;
      return { revision, schedulerEpoch };
    },
    complete(submission: SaveSubmission, outcome: SaveWriteOutcome, now: number): AutosaveCompletionAction {
      if (submission.schedulerEpoch !== schedulerEpoch) return "ignore";
      if (outcome === "skipped") {
        cancel();
        return "cancel";
      }
      if (outcome === "saved") {
        acknowledgedRevision = Math.max(acknowledgedRevision, submission.revision);
        submittedRevision = Math.max(submittedRevision, acknowledgedRevision);
        // A covering write clears backoff; an older success cannot undo a
        // newer snapshot or write failure's cooldown.
        if (acknowledgedRevision >= retryRevision) retryAt = retryRevision = 0;
        return acknowledgedRevision === revision ? "cancel" : "schedule";
      }
      // Only the latest unacknowledged submission can rewind the write gate.
      if (submission.revision > acknowledgedRevision && submission.revision === submittedRevision) {
        submittedRevision = acknowledgedRevision;
        retryAt = now + retryCooldownMs;
        retryRevision = submission.revision;
        return "schedule";
      }
      return "ignore";
    },
  };
}
