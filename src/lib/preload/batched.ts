export function yieldToAnimationFrame(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let frame: number | undefined;
    const finish = () => {
      globalThis.clearTimeout(timeout);
      if (frame !== undefined) cancelAnimationFrame(frame);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    // Background tabs suspend RAF, so a short timeout guarantees progress.
    const timeout = globalThis.setTimeout(finish, typeof requestAnimationFrame === "function" ? 100 : 0);
    signal?.addEventListener("abort", finish, { once: true });
    if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(finish);
  });
}

export function scheduleIdle(callback: () => void, timeoutMs = 5000): void {
  if (typeof window === "undefined" || typeof window.requestIdleCallback !== "function") {
    globalThis.setTimeout(callback, 0);
    return;
  }
  window.requestIdleCallback(() => callback(), { timeout: timeoutMs });
}
