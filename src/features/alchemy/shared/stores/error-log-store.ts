import { create } from "zustand";
import type { ErrorSource, LogEntry } from "@/lib/error-logger";
import { ERROR_SOURCE_IDS, registerErrorSink } from "@/lib/error-logger";
import { createInstanceId } from "@/lib/utils";

const MAX_ERRORS = 100;
const STORAGE_KEY = "alchemy-error-log";
const ERROR_SOURCES = new Set<ErrorSource>(ERROR_SOURCE_IDS);

export interface LoggedError {
  id: string;
  timestamp: number;
  message: string;
  source: ErrorSource;
  stack?: string | undefined;
  componentStack?: string | undefined;
  context?: Record<string, unknown> | undefined;
  reviewed: boolean;
}

interface ErrorLogFields {
  errors: LoggedError[];
}

interface ErrorLogActions {
  pushError: (entry: LogEntry) => void;
  clearErrors: () => void;
  markReviewed: (id: string) => void;
}

export type ErrorLogStore = ErrorLogFields & ErrorLogActions;

function capErrors(errors: LoggedError[]): LoggedError[] {
  return errors.slice(-MAX_ERRORS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePersistedError(value: unknown): LoggedError | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.message !== "string") return null;
  if (typeof value.timestamp !== "number" || !Number.isFinite(value.timestamp)) return null;
  if (typeof value.source !== "string" || !ERROR_SOURCES.has(value.source as ErrorSource)) return null;

  const stack = typeof value.stack === "string" ? value.stack : undefined;
  const componentStack = typeof value.componentStack === "string" ? value.componentStack : undefined;
  const context = isRecord(value.context) ? value.context : undefined;
  return {
    id: value.id,
    timestamp: value.timestamp,
    message: value.message,
    source: value.source as ErrorSource,
    stack,
    componentStack,
    context,
    reviewed: value.reviewed === true,
  };
}

export function parsePersistedErrorLog(raw: string | null): LoggedError[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return capErrors(parsed.map(normalizePersistedError).filter((entry): entry is LoggedError => entry !== null));
}

function loadPersisted(): LoggedError[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parsePersistedErrorLog(raw);
  } catch {
    // Avoid logError here: this store is itself an error sink, so reporting would recurse.
    console.warn("[error-log] Failed to load persisted errors");
    return [];
  }
}

function persist(errors: LoggedError[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistableErrors(errors)));
  } catch {
    // Avoid logError here: this store is itself an error sink, so reporting would recurse.
    console.warn("[error-log] Failed to persist errors");
  }
}

// One poisoned context (circular, BigInt) must not drop the whole batch:
// entries whose context is not JSON-serializable persist without it.
function toPersistableErrors(errors: LoggedError[]): LoggedError[] {
  return errors.map((entry) => {
    if (entry.context === undefined) return entry;
    try {
      JSON.stringify(entry.context);
      return entry;
    } catch {
      return { ...entry, context: undefined };
    }
  });
}

function createLoggedErrorId(): string {
  return `err_${createInstanceId()}`;
}

export const useErrorLogStore = create<ErrorLogStore>()((set) => ({
  errors: loadPersisted(),

  pushError: (entry: LogEntry) => {
    set((s) => {
      const id = createLoggedErrorId();
      const logged: LoggedError = {
        id,
        timestamp: Date.now(),
        message: entry.message,
        source: entry.source,
        stack: entry.stack,
        componentStack: entry.componentStack,
        context: entry.context,
        reviewed: false,
      };
      return { errors: capErrors([...s.errors, logged]) };
    });
  },

  clearErrors: () => {
    set({ errors: [] });
  },

  markReviewed: (id: string) => {
    set((s) => ({
      errors: s.errors.map((e) => (e.id === id ? { ...e, reviewed: true } : e)),
    }));
  },
}));

// Persist outside the zustand updater so the setter stays pure. Error bursts (e.g. a
// render-loop throw hitting the sink) would otherwise add synchronous serialization +
// storage I/O on top of every failure, so writes are debounced with a pagehide flush.
const ERROR_LOG_PERSIST_DEBOUNCE_MS = 500;
let errorLogPersistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingErrorLogErrors: LoggedError[] | null = null;

function scheduleErrorLogPersist(errors: LoggedError[]): void {
  pendingErrorLogErrors = errors;
  if (errorLogPersistTimer !== null) return;
  errorLogPersistTimer = setTimeout(() => {
    errorLogPersistTimer = null;
    const pending = pendingErrorLogErrors;
    pendingErrorLogErrors = null;
    if (pending) persist(pending);
  }, ERROR_LOG_PERSIST_DEBOUNCE_MS);
}

function flushErrorLogPersist(): void {
  if (errorLogPersistTimer !== null) {
    clearTimeout(errorLogPersistTimer);
    errorLogPersistTimer = null;
  }
  if (pendingErrorLogErrors) {
    const pending = pendingErrorLogErrors;
    pendingErrorLogErrors = null;
    persist(pending);
  }
}

// Exported for tests so debounced writes can be flushed deterministically.
export function flushPersistedErrorLog(): void {
  flushErrorLogPersist();
}

// Explicit boot wiring (called from main.tsx): the store module itself stays
// side-effect free so tests cannot double-register the sink, subscription,
// or pagehide flush.
let errorLogStoreInitialized = false;

export function initErrorLogStore(): void {
  if (errorLogStoreInitialized) return;
  errorLogStoreInitialized = true;
  useErrorLogStore.subscribe((state) => {
    scheduleErrorLogPersist(state.errors);
  });

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", flushErrorLogPersist);
  }

  registerErrorSink((entry) => {
    useErrorLogStore.getState().pushError(entry);
  });
}
