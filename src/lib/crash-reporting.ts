import * as Sentry from "@sentry/electron/renderer";

import { registerErrorSink, type LogEntry } from "@/lib/error-logger";

const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:\\|\/Users\/|\/home\/|\/var\/|\/tmp\/)[^\s"'<>]+/g;
const ALLOWED_TAGS = new Set(["electron", "platform", "process", "source", "screen"]);

function scrubText(value: unknown): unknown {
  return typeof value === "string" ? value.replace(ABSOLUTE_PATH_PATTERN, "[local-path]") : value;
}

export function scrubRendererEvent(event: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const originalTags = (event.tags ?? {}) as Record<string, unknown>;
    const tags = Object.fromEntries(
      Object.entries(originalTags)
        .filter(([key, value]) => ALLOWED_TAGS.has(key) && ["string", "number"].includes(typeof value))
        .map(([key, value]) => [key, scrubText(String(value))]),
    );
    const exception = event.exception as
      | {
          values?: Array<{
            type?: unknown;
            value?: unknown;
            stacktrace?: { frames?: Array<Record<string, unknown>> };
          }>;
        }
      | undefined;
    return {
      event_id: event.event_id,
      exception: exception
        ? {
            values: exception.values?.map((value) => ({
              type: scrubText(value.type),
              stacktrace: value.stacktrace
                ? {
                    frames: value.stacktrace.frames?.map((frame) => ({
                      colno: frame.colno,
                      filename: scrubText(frame.filename),
                      function: frame.function,
                      in_app: frame.in_app,
                      lineno: frame.lineno,
                    })),
                  }
                : undefined,
            })),
          }
        : undefined,
      level: event.level,
      platform: event.platform,
      release: event.release,
      tags,
      timestamp: event.timestamp,
    };
  } catch {
    return null;
  }
}

function reportReactFailure(entry: LogEntry): void {
  const error = entry.cause instanceof Error ? entry.cause : new Error(entry.message);
  Sentry.withScope((scope) => {
    scope.setTag("process", "renderer");
    scope.setTag("source", "react");
    const screen = entry.context?.screen;
    if (typeof screen === "string") scope.setTag("screen", screen);
    Sentry.captureException(error);
  });
}

export function initializeRendererCrashReporting(): boolean {
  if (window.alchemyDesktop?.crashReportingEnabled !== true) return false;
  try {
    Sentry.init({
      beforeSend: (event) => scrubRendererEvent(event as unknown as Record<string, unknown>) as typeof event | null,
      enableLogs: false,
      integrations: (defaults) =>
        defaults.filter((integration) =>
          ["InboundFilters", "FunctionToString", "GlobalHandlers", "LinkedErrors", "Dedupe", "ScopeToMain"].includes(
            integration.name,
          ),
        ),
      maxBreadcrumbs: 0,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    Sentry.setTags({
      electron: navigator.userAgent.match(/Electron\/([^\s]+)/)?.[1] ?? "unknown",
      platform: navigator.platform,
      process: "renderer",
    });
    registerErrorSink((entry) => {
      if (entry.source === "react") reportReactFailure(entry);
    });
    return true;
  } catch {
    return false;
  }
}
