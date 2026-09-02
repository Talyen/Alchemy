export async function batchedPreload<T>(
  items: readonly T[],
  loadOne: (item: T) => Promise<void> | void,
  options: {
    batchSize?: number;
    yieldBetweenBatches?: () => Promise<void>;
  } = {},
): Promise<void> {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 4));
  const yieldFn = options.yieldBetweenBatches ?? (() => Promise.resolve());
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await Promise.all(batch.map((item) => Promise.resolve(loadOne(item))));
    if (index + batchSize < items.length) await yieldFn();
  }
}

export function yieldToAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}

export function scheduleIdle(callback: () => void, timeoutMs = 5000, retries = 0): void {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(
      () => {
        const nav =
          typeof navigator !== "undefined"
            ? (navigator as Navigator & { scheduling?: { isInputPending?: () => boolean } })
            : undefined;
        if (retries < 3 && nav?.scheduling?.isInputPending?.()) {
          scheduleIdle(callback, timeoutMs, retries + 1);
          return;
        }
        callback();
      },
      { timeout: timeoutMs },
    );
    return;
  }
  globalThis.setTimeout(callback, 0);
}
