import { IMAGE_PRELOAD_BATCH_SIZE } from "../game-constants";
import { yieldToAnimationFrame } from "./batched";
import { waitForImage } from "./image-readiness";

interface PendingImageLoad {
  promise: Promise<void>;
  image: HTMLImageElement;
  cancel: () => void;
}

const pendingLoads = new Map<string, PendingImageLoad>();
const readyImages = new Map<string, HTMLImageElement>();
const MAX_IMAGE_CACHE_SIZE = 500;
let resetSignal = new AbortController();

export function resetImagePreloadCache(): void {
  const previous = resetSignal;
  resetSignal = new AbortController();
  previous.abort();
  for (const { image, cancel } of pendingLoads.values()) {
    cancel();
    image.removeAttribute("src");
  }
  pendingLoads.clear();
  for (const image of readyImages.values()) image.removeAttribute("src");
  readyImages.clear();
}

function rememberReady(src: string, image: HTMLImageElement): void {
  if (readyImages.size >= MAX_IMAGE_CACHE_SIZE) {
    const oldest = readyImages.keys().next().value;
    if (oldest !== undefined) {
      readyImages.get(oldest)?.removeAttribute("src");
      readyImages.delete(oldest);
    }
  }
  readyImages.delete(src);
  readyImages.set(src, image);
}

function waitForPending(pending: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return pending;
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      resolve();
    };
    const done = () => {
      cleanup();
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void pending.then(done, done);
  });
}

/** Warm the shared image cache; aborting a waiter never cancels the shared fetch. */
export function preloadImage(src: string, signal?: AbortSignal): Promise<void> {
  if (!src || signal?.aborted) return Promise.resolve();
  const ready = readyImages.get(src);
  if (ready) {
    readyImages.delete(src);
    readyImages.set(src, ready);
    return Promise.resolve();
  }
  const pending = pendingLoads.get(src);
  if (pending) return waitForPending(pending.promise, signal);

  const epoch = resetSignal;
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  const lifetime = new AbortController();
  const promise = waitForImage(image, lifetime.signal).then((loaded) => {
    pendingLoads.delete(src);
    // A reset orphaned this fetch, or a later reset already replaced it.
    if (lifetime.signal.aborted || resetSignal !== epoch) return;
    // Failed warmups must not keep fetching; visible artwork loads on its own element.
    if (!loaded) image.removeAttribute("src");
    else rememberReady(src, image);
  });
  pendingLoads.set(src, { promise, image, cancel: () => lifetime.abort() });
  return waitForPending(promise, signal);
}

export async function preloadImagesInBatches(
  srcs: readonly string[],
  batchSize = IMAGE_PRELOAD_BATCH_SIZE,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const stop = new AbortController();
  const onStop = () => stop.abort();
  const epochSignal = resetSignal.signal;
  signal?.addEventListener("abort", onStop, { once: true });
  epochSignal.addEventListener("abort", onStop);
  try {
    if (stop.signal.aborted) return;
    const batch = Number.isFinite(batchSize) && batchSize > 0 ? Math.max(1, Math.floor(batchSize)) : 4;
    const uniqueSrcs = Array.from(new Set(srcs.filter(Boolean)));
    const total = uniqueSrcs.length;
    let loaded = 0;
    onProgress?.(loaded, total);
    for (let index = 0; index < uniqueSrcs.length && !stop.signal.aborted; index += batch) {
      const group = uniqueSrcs.slice(index, index + batch);
      await Promise.all(
        group.map((src) =>
          preloadImage(src, stop.signal).then(() => {
            if (stop.signal.aborted) return;
            loaded += 1;
            onProgress?.(loaded, total);
          }),
        ),
      );
      if (!stop.signal.aborted && index + batch < uniqueSrcs.length) await yieldToAnimationFrame(stop.signal);
    }
  } finally {
    stop.abort();
    signal?.removeEventListener("abort", onStop);
    epochSignal.removeEventListener("abort", onStop);
  }
}
