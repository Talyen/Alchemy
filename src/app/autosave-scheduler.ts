import type { SaveWriteOutcome } from "@/features/alchemy/shared/storage";
import { clamp } from "@/lib/math";

export interface AutosaveDelayInput {
  debounceMs: number;
  maxWaitMs: number;
  now: number;
  dirtySince: number;
  retryAt: number;
}

export function computeAutosaveDelay(input: AutosaveDelayInput): number {
  const maxWaitDelay = Math.max(0, input.maxWaitMs - (input.now - input.dirtySince));
  // A pending failure retry dominates the debounce so new changes cannot bypass the cooldown.
  return Math.max(input.retryAt - input.now, clamp(maxWaitDelay, 0, input.debounceMs));
}

export interface FlushGate {
  revision: number;
  acknowledgedRevision: number;
  submittedRevision: number;
  terminal: boolean;
}

export function shouldAttemptFlush(gate: FlushGate): boolean {
  if (gate.revision <= gate.acknowledgedRevision) return false;
  if (!gate.terminal && gate.revision <= gate.submittedRevision) return false;
  return true;
}

interface AutosaveProgress {
  revision: number;
  acknowledgedRevision: number;
  submittedRevision: number;
  retryAt: number;
}

export interface CompletionInput extends AutosaveProgress {
  savingRevision: number;
  outcome: Exclude<SaveWriteOutcome, "skipped">;
  now: number;
  maxWaitMs: number;
}

export type AutosaveCompletionAction = "ignore" | "cancel" | "schedule";

export interface CompletionResult extends AutosaveProgress {
  action: AutosaveCompletionAction;
}

export function applyAutosaveCompletion(input: CompletionInput): CompletionResult {
  if (input.outcome === "saved") {
    const acknowledgedRevision = Math.max(input.acknowledgedRevision, input.savingRevision);
    const retryAt = input.savingRevision === input.submittedRevision ? 0 : input.retryAt;
    const covered = acknowledgedRevision === input.revision;
    return {
      revision: input.revision,
      acknowledgedRevision,
      submittedRevision: input.submittedRevision,
      retryAt,
      action: covered ? "cancel" : "schedule",
    };
  }
  if (input.savingRevision > input.acknowledgedRevision && input.savingRevision === input.submittedRevision) {
    return {
      revision: input.revision,
      acknowledgedRevision: input.acknowledgedRevision,
      submittedRevision: input.acknowledgedRevision,
      retryAt: input.now + input.maxWaitMs,
      action: "schedule",
    };
  }
  return {
    revision: input.revision,
    acknowledgedRevision: input.acknowledgedRevision,
    submittedRevision: input.submittedRevision,
    retryAt: input.retryAt,
    action: "ignore",
  };
}

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
 * a "skipped" outcome alone once the scheduler has reset. */
export function createAutosaveScheduler(maxWaitMs: number) {
  let revision = 0;
  let acknowledgedRevision = 0;
  let submittedRevision = 0;
  let schedulerEpoch = 0;
  let terminalSubmittedRevision = 0;
  let dirtySince = 0;
  let retryAt = 0;

  function cancel() {
    schedulerEpoch++;
    revision = acknowledgedRevision = submittedRevision = dirtySince = retryAt = terminalSubmittedRevision = 0;
  }

  function canSubmit(terminal: boolean): boolean {
    // Peek without mutating so callers can skip snapshot work when idle.
    // Exit-once latch: back-to-back pagehide/beforeunload/visibilitychange for
    // the same revision submit once; the next markDirty moves revision forward.
    if (terminal && revision === terminalSubmittedRevision) return false;
    return shouldAttemptFlush({ revision, acknowledgedRevision, submittedRevision, terminal });
  }

  return {
    cancel,
    canSubmit,
    markDirty(now: number) {
      // Preserve the original max-wait window across failure rewinds and partial
      // saves: only a fully submitted revision restarts the dirty-since clock.
      if (revision === submittedRevision) dirtySince = now;
      revision++;
    },
    nextDelay(now: number, debounceMs: number): number | null {
      if (!shouldAttemptFlush({ revision, acknowledgedRevision, submittedRevision, terminal: false })) return null;
      return computeAutosaveDelay({ debounceMs, maxWaitMs, now, dirtySince, retryAt });
    },
    submit(terminal: boolean): SaveSubmission | null {
      if (!canSubmit(terminal)) {
        return null;
      }
      submittedRevision = revision;
      if (terminal) terminalSubmittedRevision = revision;
      return { revision, schedulerEpoch };
    },
    complete(submission: SaveSubmission, outcome: SaveWriteOutcome, now: number): AutosaveCompletionAction {
      if (submission.schedulerEpoch !== schedulerEpoch) return "ignore";
      if (outcome === "skipped") {
        cancel();
        return "cancel";
      }
      const next = applyAutosaveCompletion({
        revision,
        acknowledgedRevision,
        submittedRevision,
        retryAt,
        savingRevision: submission.revision,
        outcome,
        now,
        maxWaitMs,
      });
      acknowledgedRevision = next.acknowledgedRevision;
      submittedRevision = next.submittedRevision;
      retryAt = next.retryAt;
      return next.action;
    },
  };
}
