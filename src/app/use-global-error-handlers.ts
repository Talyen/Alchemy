// Installs window.onerror and unhandledrejection handlers to capture errors
// outside React's render cycle and route them through the centralized logger.
import { useEffect } from "react";
import { logError } from "@/lib/error-logger";

function stackOf(value: unknown): string | undefined {
  const stack = (value as { stack?: unknown } | null)?.stack;
  return typeof stack === "string" ? stack : undefined;
}

function messageOf(value: unknown): string {
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(value);
}

export function useGlobalErrorHandlers(): void {
  useEffect(() => {
    function onGlobalError(event: ErrorEvent) {
      logError(
        event.message,
        "global",
        { filename: event.filename, lineno: event.lineno, colno: event.colno },
        stackOf(event.error),
      );
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason: unknown = event.reason;
      logError(messageOf(reason), "promise", undefined, stackOf(reason));
    }

    window.addEventListener("error", onGlobalError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onGlobalError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
}
