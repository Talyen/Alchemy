// Centralized error logger with pluggable sinks.
// Sinks are registered by the app layer (main.tsx) after stores initialize.
// During early boot errors fall through to console.error only.
// Kept free of features/ imports to avoid circular deps.

export type ErrorSource =
  | "react"
  | "global"
  | "promise"
  | "battle"
  | "storage"
  | "validation"
  | "audio"
  | "card"
  | "other";

export interface LogEntry {
  message: string;
  source: ErrorSource;
  stack?: string | undefined;
  context?: Record<string, unknown> | undefined;
  componentStack?: string | undefined;
  cause?: unknown;
}

type LogSink = (entry: LogEntry) => void;

let sinks: LogSink[] = [];
let logging = false;

export function registerErrorSink(sink: LogSink): void {
  sinks = [...sinks, sink];
}

/** Test-only isolation for module-scoped sink state. */
export function resetErrorSinksForTests(): void {
  sinks = [];
}

export function logError(
  message: string,
  source: ErrorSource,
  context?: Record<string, unknown>,
  stack?: string,
  componentStack?: string,
  cause?: unknown,
): void {
  if (logging) return;
  logging = true;
  const entry: LogEntry = { message, source, stack, context, componentStack, cause };
  try {
    console.error(`[${source}] ${message}`, context ?? "", stack ?? "", componentStack ?? "");
    for (const sink of sinks) {
      try {
        sink(entry);
      } catch {
        // sinks must not throw
      }
    }
  } catch {
    // last resort — nothing we can do
  } finally {
    logging = false;
  }
}
