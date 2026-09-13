export const ERROR_SOURCE_IDS = [
  "react",
  "global",
  "promise",
  "battle",
  "storage",
  "validation",
  "audio",
  "card",
  "other",
] as const;

export type ErrorSource = (typeof ERROR_SOURCE_IDS)[number];

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
let droppedReentrantLogs = 0;

/**
 * Sinks must never call `logError`: reentrant calls are dropped and counted
 * so a sink-side failure stays visible instead of silently vanishing.
 */
export function registerErrorSink(sink: LogSink): () => void {
  sinks = [...sinks, sink];
  return () => {
    sinks = sinks.filter((s) => s !== sink);
  };
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
  if (logging) {
    droppedReentrantLogs += 1;
    console.warn(`[other] Dropped reentrant logError call (${droppedReentrantLogs} total): ${message}`);
    return;
  }
  logging = true;
  const entry: LogEntry = { message, source, stack, context, componentStack, cause };
  try {
    console.error(`[${source}] ${message}`, context ?? "", stack ?? "", componentStack ?? "");
    for (const sink of sinks) {
      try {
        sink(entry);
      } catch {
        // One bad sink (e.g. full storage) must not break logging for the rest.
      }
    }
  } catch {
    // console.error itself failed; there is no deeper sink that could report it.
  } finally {
    logging = false;
  }
}
