export async function batchedPreload<T>(
  items: readonly T[],
  loadOne: (item: T) => Promise<void> | void,
  options: {
    batchSize?: number;
    signal?: AbortSignal;
    yieldBetweenBatches?: () => Promise<void>;
  } = {},
): Promise<void> {
  const rawBatch = options.batchSize ?? 4;
  const batchSize = Number.isFinite(rawBatch) && rawBatch > 0 ? Math.max(1, Math.floor(rawBatch)) : 4;
  for (let index = 0; index < items.length && !options.signal?.aborted; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    // Capture synchronous throws as rejections too, so every started load
    // belongs to Promise.all and cannot leave an unhandled rejection behind.
    await Promise.all(
      batch.map(async (item) => {
        if (!options.signal?.aborted) await loadOne(item);
      }),
    );
    if (!options.signal?.aborted && index + batchSize < items.length) await options.yieldBetweenBatches?.();
  }
}

export function yieldToAnimationFrame(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let frame: number | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      if (frame !== undefined) cancelAnimationFrame(frame);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    // Background tabs suspend RAF; cancellation must release both scheduling paths.
    const timeout = globalThis.setTimeout(finish, typeof requestAnimationFrame === "function" ? 100 : 0);
    signal?.addEventListener("abort", finish, { once: true });
    if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(finish);
  });
}

export function scheduleIdle(callback: () => void, timeoutMs = 5000): void {
  const run = () => {
    try {
      callback();
    } catch (error) {
      console.error("scheduleIdle callback threw an error:", error);
    }
  };
  if (typeof window === "undefined" || typeof window.requestIdleCallback !== "function") {
    globalThis.setTimeout(run, 0);
    return;
  }
  let retries = 0;
  const onIdle: IdleRequestCallback = (deadline) => {
    const nav = window.navigator as Navigator & { scheduling?: { isInputPending?: () => boolean } };
    if (!deadline.didTimeout && retries < 3 && nav.scheduling?.isInputPending?.()) {
      retries++;
      window.requestIdleCallback(onIdle, { timeout: timeoutMs });
    } else {
      run();
    }
  };
  window.requestIdleCallback(onIdle, { timeout: timeoutMs });
}
