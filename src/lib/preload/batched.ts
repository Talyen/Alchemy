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
  const yieldFn = options.yieldBetweenBatches ?? (() => Promise.resolve());
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await Promise.all(batch.map((item) => Promise.resolve(loadOne(item))));
    if (index + batchSize < items.length) await yieldFn();
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

export function scheduleIdle(callback: () => void, timeoutMs = 5000, retries = 0): void {
  const run = () => {
    try {
      callback();
    } catch (error) {
      console.error("scheduleIdle callback threw an error:", error);
    }
  };
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(
      (deadline) => {
        const nav = window.navigator as Navigator & { scheduling?: { isInputPending?: () => boolean } };
        if (!deadline?.didTimeout && retries < 3 && nav?.scheduling?.isInputPending?.()) {
          scheduleIdle(callback, timeoutMs, retries + 1);
          return;
        }
        run();
      },
      { timeout: timeoutMs },
    );
    return;
  }
  globalThis.setTimeout(run, 0);
}
