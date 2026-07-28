import * as Sentry from "@sentry/electron/renderer";

import { registerErrorSink, type LogEntry } from "@/lib/error-logger";

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
      enableLogs: false,
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
