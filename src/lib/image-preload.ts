import { IMAGE_PRELOAD_BATCH_SIZE, IMAGE_PRELOAD_TIMEOUT_MS } from "./game-constants";
import { batchedPreload, yieldToAnimationFrame } from "./preload/batched";

interface ImageLoadEntry {
  token: object;
  promise: Promise<void>;
}

const imageLoads = new Map<string, ImageLoadEntry>();
const MAX_IMAGE_CACHE_SIZE = 500;

export function preloadImage(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  const existing = imageLoads.get(src);
  if (existing) return existing.promise;

  if (imageLoads.size >= MAX_IMAGE_CACHE_SIZE) {
    const firstKey = imageLoads.keys().next().value;
    if (firstKey) imageLoads.delete(firstKey);
  }

  const token = {};
  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";

    let handled = false;

    function finish(keepCached: boolean) {
      if (handled) return;
      handled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (!keepCached && imageLoads.get(src)?.token === token) {
        imageLoads.delete(src);
      }
      resolve();
    }

    function handleLoad() {
      if (handled) return;
      image.onload = null;
      image.onerror = null;
      void image.decode().then(
        () => finish(true),
        () => finish(false),
      );
    }

    const timeout = globalThis.setTimeout(() => finish(false), IMAGE_PRELOAD_TIMEOUT_MS);
    image.onload = handleLoad;
    image.onerror = () => finish(false);
    image.src = src;

    if (image.complete) {
      handleLoad();
    }
  });

  imageLoads.set(src, { token, promise });
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
