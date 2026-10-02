import { IMAGE_PRELOAD_BATCH_SIZE } from "../game-constants";
import { batchedPreload, yieldToAnimationFrame } from "./batched";
import { waitForImage } from "./image-readiness";

const imageLoads = new Map<string, Promise<void>>();
const MAX_IMAGE_CACHE_SIZE = 500;

export function resetImagePreloadCache(): void {
  imageLoads.clear();
}

export function preloadImage(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  const existing = imageLoads.get(src);
  if (existing) {
    imageLoads.delete(src);
    imageLoads.set(src, existing);
    return existing;
  }

  if (imageLoads.size >= MAX_IMAGE_CACHE_SIZE) {
    const firstKey = imageLoads.keys().next().value;
    if (firstKey) imageLoads.delete(firstKey);
  }

  const image = new Image();
  image.decoding = "async";
  image.src = src;
  const promise = waitForImage(image).then((ready) => {
    // Promise identity keeps an old failure from evicting a retry after reset.
    if (!ready && imageLoads.get(src) === promise) imageLoads.delete(src);
  });
  imageLoads.set(src, promise);
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
      batchSize: Math.max(1, Math.floor(batchSize)),
      yieldBetweenBatches: yieldToAnimationFrame,
    },
  );
}
