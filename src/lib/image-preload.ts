// Image preloading helpers for warming likely-next game art without blocking the
// current interaction. Used by the app shell to reduce visible image pop-in.
import { IMAGE_PRELOAD_BATCH_SIZE, IMAGE_PRELOAD_IDLE_TIMEOUT } from "./game-constants";

// Cache storing in-flight and completed load promises by image source URL.
const imageLoads = new Map<string, Promise<void>>();

// Decodes an image once and caches the promise so repeated route predictions can
// share work instead of creating competing network requests.
export function preloadImage(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  const existing = imageLoads.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";

    function finish() {
      image.onload = null;
      image.onerror = null;
      resolve();
    }

    function handleLoad() {
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
export function preloadImages(srcs: string[]): void {
  srcs.forEach((src) => {
    void preloadImage(src);
  });
}

// Spreads speculative image decoding across idle time so menu and battle input
// remain responsive while future screen art is prepared.
export function preloadImagesWhenIdle(srcs: string[]): void {
  const uniqueSrcs = Array.from(new Set(srcs.filter(Boolean)));
  let index = 0;

  function preloadNextBatch() {
    preloadImages(uniqueSrcs.slice(index, index + IMAGE_PRELOAD_BATCH_SIZE));
    index += IMAGE_PRELOAD_BATCH_SIZE;
    if (index < uniqueSrcs.length) schedulePreloadBatch(preloadNextBatch);
  }

  schedulePreloadBatch(preloadNextBatch);
}

// Uses idle callbacks when available and falls back to a timer in browsers that
// do not expose requestIdleCallback.
function schedulePreloadBatch(callback: () => void): void {
  if ("requestIdleCallback" in globalThis) {
    (globalThis as Window & typeof globalThis).requestIdleCallback(callback, {
      timeout: IMAGE_PRELOAD_IDLE_TIMEOUT,
    });
    return;
  }

  globalThis.setTimeout(callback, 0);
}
