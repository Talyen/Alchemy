import { IMAGE_PRELOAD_BATCH_SIZE } from "../game-constants";
import { batchedPreload, yieldToAnimationFrame } from "./batched";
import { waitForImage } from "./image-readiness";

interface PendingImageLoad {
  promise: Promise<void>;
  image: HTMLImageElement;
  lifetime: AbortController;
  consumers: number;
  unscoped: boolean;
}

interface CompletedImageLoad {
  promise: Promise<void>;
  image: HTMLImageElement;
}

const imageLoads = new Map<string, PendingImageLoad>();
const loadedImages = new Map<string, CompletedImageLoad>();
const MAX_IMAGE_CACHE_SIZE = 500;
let cacheLifetime = new AbortController();

export function resetImagePreloadCache(): void {
  const previous = cacheLifetime;
  cacheLifetime = new AbortController();
  previous.abort();
  for (const { image, lifetime } of imageLoads.values()) {
    lifetime.abort();
    image.removeAttribute("src");
  }
  for (const { image } of loadedImages.values()) {
    image.removeAttribute("src");
  }
  imageLoads.clear();
  loadedImages.clear();
}

function borrowLoad(src: string, load: PendingImageLoad, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    load.unscoped = true;
    return load.promise;
  }
  load.consumers++;
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", finish);
      load.consumers--;
      if (!load.unscoped && load.consumers === 0 && imageLoads.get(src) === load) {
        imageLoads.delete(src);
        load.lifetime.abort();
        load.image.removeAttribute("src");
      }
      resolve();
    };
    signal.addEventListener("abort", finish, { once: true });
    void load.promise.then(finish);
    if (signal.aborted) finish();
  });
}

/** Each cancellable consumer borrows the shared fetch; the last departure releases it. */
export function preloadImage(src: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  if (!src) return Promise.resolve();
  const pending = imageLoads.get(src);
  if (pending) return borrowLoad(src, pending, signal);
  const existing = loadedImages.get(src);
  if (existing) {
    loadedImages.delete(src);
    loadedImages.set(src, existing);
    return existing.promise;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = src;
  const lifetime = new AbortController();
  const promise = waitForImage(image, lifetime.signal).then((ready) => {
    // Reset aborts the old lifetime before a replacement can start.
    if (lifetime.signal.aborted) return;
    // Failed or timed-out warmups should not keep fetching or decoding an
    // orphaned image. Visible artwork has its own image element.
    if (!ready) image.removeAttribute("src");
    imageLoads.delete(src);
    if (!ready) return;
    if (loadedImages.size >= MAX_IMAGE_CACHE_SIZE) {
      const firstKey = loadedImages.keys().next().value;
      if (firstKey !== undefined) {
        loadedImages.get(firstKey)?.image.removeAttribute("src");
        loadedImages.delete(firstKey);
      }
    }
    loadedImages.set(src, { promise, image });
  });
  const load = { promise, image, lifetime, consumers: 0, unscoped: false };
  imageLoads.set(src, load);
  return borrowLoad(src, load, signal);
}

export async function preloadImagesInBatches(
  srcs: readonly string[],
  batchSize = IMAGE_PRELOAD_BATCH_SIZE,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const lifetime = new AbortController();
  const sources = signal ? [signal, cacheLifetime.signal] : [cacheLifetime.signal];
  const cancel = () => lifetime.abort();
  for (const source of sources) {
    source.addEventListener("abort", cancel, { once: true });
    if (source.aborted) cancel();
  }
  if (lifetime.signal.aborted) {
    for (const source of sources) source.removeEventListener("abort", cancel);
    return;
  }
  const uniqueSrcs = Array.from(new Set(srcs.filter(Boolean)));
  const total = uniqueSrcs.length;
  let loaded = 0;
  try {
    onProgress?.(loaded, total);

    await batchedPreload(
      uniqueSrcs,
      async (src) => {
        await preloadImage(src, lifetime.signal);
        if (lifetime.signal.aborted) return;
        loaded += 1;
        onProgress?.(loaded, total);
      },
      {
        batchSize,
        signal: lifetime.signal,
        yieldBetweenBatches: () => yieldToAnimationFrame(lifetime.signal),
      },
    );
  } finally {
    lifetime.abort();
    for (const source of sources) source.removeEventListener("abort", cancel);
  }
}
