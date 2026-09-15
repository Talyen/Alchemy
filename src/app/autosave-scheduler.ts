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
  return Math.max(input.retryAt - input.now, clamp(maxWaitDelay, 0, input.debounceMs));
}

export interface FlushGate {
  enabled: boolean;
  revision: number;
  acknowledgedRevision: number;
  submittedRevision: number;
  terminal: boolean;
}

export function shouldAttemptFlush(gate: FlushGate): boolean {
  if (!gate.enabled) return false;
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

export interface CompletionResult extends AutosaveProgress {
  schedule: boolean;
  cancelTimer: boolean;
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
      schedule: !covered,
      cancelTimer: covered,
    };
  }
  if (input.savingRevision > input.acknowledgedRevision && input.savingRevision === input.submittedRevision) {
    return {
      revision: input.revision,
      acknowledgedRevision: input.acknowledgedRevision,
      submittedRevision: input.acknowledgedRevision,
      retryAt: input.now + input.maxWaitMs,
      schedule: true,
      cancelTimer: false,
    };
  }
  return {
    revision: input.revision,
    acknowledgedRevision: input.acknowledgedRevision,
    submittedRevision: input.submittedRevision,
    retryAt: input.retryAt,
    schedule: false,
    cancelTimer: false,
  };
}

interface SaveSubmission {
  readonly revision: number;
  readonly generation: number;
}

type CompletionAction = "ignore" | "cancel" | "schedule";

/** Owns one subscription lifetime. The adapter supplies clocks, timers, and storage.
 *
 * Scheduler generation guards hook-lifetime invalidation (cancel on unmount or
 * disable must ignore late completions). SaveWriteQueue.writeGeneration guards
 * storage invalidation (clear or write protection must skip stale writes).
 * Both are required: the queue cannot repair scheduler revision counters from
 * a "skipped" outcome alone once the scheduler has reset. */
export function createAutosaveScheduler(maxWaitMs: number) {
  let revision = 0;
  let acknowledgedRevision = 0;
  let submittedRevision = 0;
  let generation = 0;
  let dirtySince = 0;
  let retryAt = 0;

  function cancel() {
    generation++;
    revision = acknowledgedRevision = submittedRevision = dirtySince = retryAt = 0;
  }

  return {
    cancel,
    markDirty(now: number) {
      if (revision === submittedRevision) dirtySince = now;
      revision++;
    },
    nextDelay(now: number, debounceMs: number): number | null {
      if (revision <= submittedRevision) return null;
      return computeAutosaveDelay({ debounceMs, maxWaitMs, now, dirtySince, retryAt });
    },
    submit(terminal: boolean): SaveSubmission | null {
      if (!shouldAttemptFlush({ enabled: true, revision, acknowledgedRevision, submittedRevision, terminal })) {
        return null;
      }
      submittedRevision = revision;
      return { revision, generation };
    },
    complete(submission: SaveSubmission, outcome: SaveWriteOutcome, now: number): CompletionAction {
      if (submission.generation !== generation) return "ignore";
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
      return next.cancelTimer ? "cancel" : next.schedule ? "schedule" : "ignore";
    },
  };
}
