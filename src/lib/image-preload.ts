// Image preloading helpers for warming likely-next game art without blocking the
// current interaction. Used by the app shell to reduce visible image pop-in.
import { IMAGE_PRELOAD_BATCH_SIZE } from "./game-constants";

// Cache storing in-flight and completed load promises by image source URL.
const imageLoads = new Map<string, Promise<void>>();
const MAX_IMAGE_CACHE_SIZE = 500;

// Decodes an image once and caches the promise so repeated route predictions can
// share work instead of creating competing network requests.
export function preloadImage(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  const existing = imageLoads.get(src);
  if (existing) return existing;

  if (imageLoads.size >= MAX_IMAGE_CACHE_SIZE) {
    const firstKey = imageLoads.keys().next().value;
    if (firstKey) imageLoads.delete(firstKey);
  }

  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";

    let handled = false;

    function finish() {
      image.onload = null;
      image.onerror = null;
      resolve();
    }

    function handleLoad() {
      if (handled) return;
      handled = true;
      image.onload = null;
      image.onerror = null;
      image
        .decode()
        .catch(() => {})
        .finally(finish);
    }

    image.onload = handleLoad;
    image.onerror = finish;
    image.src = src;

    if (image.complete) {
      handleLoad();
    }
  });

  imageLoads.set(src, promise);
  return promise;
}

// Warms a list immediately for high-confidence assets, such as the current battle
// enemy and hand images, while still allowing the browser to prioritize rendering.
export function preloadImages(srcs: readonly string[]): Promise<void> {
  return Promise.all(srcs.map(preloadImage)).then(() => undefined);
}

// Warms the complete set while yielding between bounded batches. Startup awaits this
// function before revealing the app, so gameplay still begins with every asset decoded;
// the yields only keep the loading presentation responsive during the up-front work.
export async function preloadImagesInBatches(
  srcs: readonly string[],
  batchSize = IMAGE_PRELOAD_BATCH_SIZE,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const uniqueSrcs = Array.from(new Set(srcs.filter(Boolean)));
  const resolvedBatchSize = Math.max(1, Math.floor(batchSize));
  const total = uniqueSrcs.length;
  let loaded = 0;
  onProgress?.(loaded, total);

  for (let index = 0; index < uniqueSrcs.length; index += resolvedBatchSize) {
    const batch = uniqueSrcs.slice(index, index + resolvedBatchSize);
    await Promise.all(
      batch.map(async (src) => {
        await preloadImage(src);
        loaded += 1;
        onProgress?.(loaded, total);
      }),
    );
    if (index + resolvedBatchSize < uniqueSrcs.length) {
      await yieldToBrowser();
    }
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}
