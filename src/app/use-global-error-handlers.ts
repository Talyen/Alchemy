// Installs window.onerror and unhandledrejection handlers to capture errors
// outside React's render cycle and route them through the centralized logger.
import { useEffect } from "react";
import { logError } from "@/lib/error-logger";

export function useGlobalErrorHandlers(): void {
  useEffect(() => {
    function onGlobalError(event: ErrorEvent) {
      logError(
        event.message,
        "global",
        { filename: event.filename, lineno: event.lineno, colno: event.colno },
        event.error?.stack,
      );
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      logError(reason?.message ?? String(reason), "promise", undefined, reason?.stack);
    }

    window.addEventListener("error", onGlobalError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onGlobalError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
}
