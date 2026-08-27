export const STARTUP_READY_MARK = "alchemy:startup:ready";

export function markStartupReady(): void {
  try {
    if (performance.getEntriesByName(STARTUP_READY_MARK, "mark").length === 0) {
      performance.mark(STARTUP_READY_MARK);
    }
  } catch {
    // User Timing is unavailable in a few test/webview environments.
  }
}
