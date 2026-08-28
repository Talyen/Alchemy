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
      } catch {}
    }
  } catch {
  } finally {
    logging = false;
  }
}
