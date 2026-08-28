import { create } from "zustand";
import type { ErrorSource, LogEntry } from "@/lib/error-logger";
import { registerErrorSink } from "@/lib/error-logger";

const MAX_ERRORS = 100;
const STORAGE_KEY = "alchemy-error-log";
const ERROR_SOURCES = new Set<ErrorSource>([
  "react",
  "global",
  "promise",
  "battle",
  "storage",
  "validation",
  "audio",
  "card",
  "other",
]);

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
  return parsed
    .map(normalizePersistedError)
    .filter((entry): entry is LoggedError => entry !== null)
    .slice(-MAX_ERRORS);
}

function loadPersisted(): LoggedError[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const errors = parsePersistedErrorLog(raw);
    if (raw && JSON.stringify(errors) !== raw) persist(errors);
    return errors;
  } catch {
    persist([]);
    return [];
  }
}

function persist(errors: LoggedError[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
  } catch {}
}

let nextId = 0;

export const useErrorLogStore = create<ErrorLogStore>()((set) => ({
  errors: loadPersisted(),

  pushError: (entry: LogEntry) => {
    set((s) => {
      const id = `err_${Date.now()}_${nextId++}`;
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
      const next = [...s.errors.slice(-(MAX_ERRORS - 1)), logged];
      persist(next);
      return { errors: next };
    });
  },

  clearErrors: () => {
    persist([]);
    set({ errors: [] });
  },

  markReviewed: (id: string) => {
    set((s) => {
      const next = s.errors.map((e) => (e.id === id ? { ...e, reviewed: true } : e));
      persist(next);
      return { errors: next };
    });
  },
}));

registerErrorSink((entry) => {
  useErrorLogStore.getState().pushError(entry);
});
