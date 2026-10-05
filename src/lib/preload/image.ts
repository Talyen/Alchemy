import { IMAGE_PRELOAD_BATCH_SIZE } from "../game-constants";
import { batchedPreload, yieldToAnimationFrame } from "./batched";
import { waitForImage } from "./image-readiness";

interface PendingImageLoad {
  promise: Promise<void>;
  image: HTMLImageElement;
  lifetime: AbortController;
}

const imageLoads = new Map<string, PendingImageLoad>();
const loadedImages = new Map<string, Promise<void>>();
const MAX_IMAGE_CACHE_SIZE = 500;

export function resetImagePreloadCache(): void {
  for (const { image, lifetime } of imageLoads.values()) {
    lifetime.abort();
    image.removeAttribute("src");
  }
  imageLoads.clear();
  loadedImages.clear();
}

export function preloadImage(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  const pending = imageLoads.get(src);
  if (pending) return pending.promise;
  const existing = loadedImages.get(src);
  if (existing) {
    loadedImages.delete(src);
    loadedImages.set(src, existing);
    return existing;
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
      if (firstKey !== undefined) loadedImages.delete(firstKey);
    }
    loadedImages.set(src, promise);
  });
  imageLoads.set(src, { promise, image, lifetime });
  return promise;
}

export async function preloadImagesInBatches(
  srcs: readonly string[],
  batchSize = IMAGE_PRELOAD_BATCH_SIZE,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const uniqueSrcs = Array.from(new Set(srcs.filter(Boolean)));
  const total = uniqueSrcs.length;
  let loaded = 0;
  onProgress?.(loaded, total);

  await batchedPreload(
    uniqueSrcs,
    async (src) => {
      await preloadImage(src);
      loaded += 1;
      onProgress?.(loaded, total);
    },
    {
      batchSize,
      yieldBetweenBatches: yieldToAnimationFrame,
    },
  );
}
