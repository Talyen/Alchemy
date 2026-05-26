// Centralized error logger with pluggable sinks.
// Sinks are registered by the app layer (main.tsx) after stores initialize.
// During early boot errors fall through to console.error only.
// Depends on: nothing from features to avoid circular deps.

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
}

type LogSink = (entry: LogEntry) => void;

let sinks: LogSink[] = [];
let logging = false;

export function registerErrorSink(sink: LogSink): void {
  sinks = [...sinks, sink];
}

export function logError(
  message: string,
  source: ErrorSource,
  context?: Record<string, unknown>,
  stack?: string,
  componentStack?: string,
): void {
  if (logging) return;
  logging = true;
  const entry: LogEntry = { message, source, stack, context, componentStack };
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
