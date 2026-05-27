// Zustand store for structured error logs with localStorage persistence.
// Errors survive reload so devs can inspect crashes after the fact.
// Cap at MAX_ERRORS to prevent unbounded growth.
import { create } from "zustand";
import type { ErrorSource, LogEntry } from "@/lib/error-logger";
import { registerErrorSink } from "@/lib/error-logger";

const MAX_ERRORS = 100;
const STORAGE_KEY = "alchemy-error-log";

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

function loadPersisted(): LoggedError[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LoggedError[];
  } catch {
    return [];
  }
}

function persist(errors: LoggedError[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
  } catch {
    // storage full or unavailable — silently drop
  }
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
