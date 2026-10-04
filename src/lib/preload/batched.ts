export async function batchedPreload<T>(
  items: readonly T[],
  loadOne: (item: T) => Promise<void> | void,
  options: {
    batchSize?: number;
    yieldBetweenBatches?: () => Promise<void>;
  } = {},
): Promise<void> {
  const rawBatch = options.batchSize ?? 4;
  const batchSize = Number.isFinite(rawBatch) && rawBatch > 0 ? Math.max(1, Math.floor(rawBatch)) : 4;
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    // Capture synchronous throws as rejections too, so every started load
    // belongs to Promise.all and cannot leave an unhandled rejection behind.
    await Promise.all(batch.map(async (item) => loadOne(item)));
    if (index + batchSize < items.length) await options.yieldBetweenBatches?.();
  }
}

export function yieldToAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      globalThis.setTimeout(resolve, 0);
      return;
    }
    // Background tabs suspend RAF; the loading screen must still finish.
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      cancelAnimationFrame(frame);
      resolve();
    };
    const timeout = globalThis.setTimeout(finish, 100);
    const frame = requestAnimationFrame(finish);
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
