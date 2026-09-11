import type { SaveWriteOutcome } from "@/features/alchemy/shared/storage";

export interface AutosaveDelayInput {
  debounceMs: number;
  maxWaitMs: number;
  now: number;
  dirtySince: number;
  retryAt: number;
}

export function computeAutosaveDelay(input: AutosaveDelayInput): number {
  const maxWaitDelay = Math.max(0, input.maxWaitMs - (input.now - input.dirtySince));
  return Math.max(input.retryAt - input.now, Math.min(input.debounceMs, maxWaitDelay));
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
  outcome: SaveWriteOutcome;
  now: number;
  maxWaitMs: number;
}

export interface CompletionResult extends AutosaveProgress {
  schedule: boolean;
  cancelTimer: boolean;
}

export function applyAutosaveCompletion(input: CompletionInput): CompletionResult {
  if (input.outcome === "skipped") {
    return {
      revision: 0,
      acknowledgedRevision: 0,
      submittedRevision: 0,
      retryAt: 0,
      schedule: false,
      cancelTimer: true,
    };
  }
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
