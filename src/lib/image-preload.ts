// Image preloading helpers for warming likely-next game art without blocking the
// current interaction. Used by the app shell to reduce visible image pop-in.
import { IMAGE_PRELOAD_BATCH_SIZE, IMAGE_PRELOAD_IDLE_TIMEOUT } from "./game-constants";

const imageCache = new Set<string>();
const imageLoads = new Map<string, Promise<void>>();

// Decodes an image once and caches the promise so repeated route predictions can
// share work instead of creating competing network requests.
export function preloadImage(src: string) {
  if (!src || imageCache.has(src)) return Promise.resolve();
  const existing = imageLoads.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;
    image.decoding = "async";

    function resolveOnce() {
      if (settled) return;
      settled = true;
      imageCache.add(src);
      resolve();
    }

    function decodeLoadedImage() {
      image
        .decode()
        .then(resolveOnce)
        .catch(() => {
          image
            .decode()
            .then(resolveOnce)
            .catch(() => {
              console.warn("Image decode failed:", src);
              resolveOnce();
            });
        });
    }

    image.onload = decodeLoadedImage;
    image.onerror = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    image.src = src;
    if (image.complete) decodeLoadedImage();
  });

  imageLoads.set(src, promise);
  return promise;
}

// Warms a list immediately for high-confidence assets, such as the current battle
// enemy and hand images, while still allowing the browser to prioritize rendering.
export function preloadImages(srcs: string[]) {
  srcs.forEach((src) => {
    void preloadImage(src);
  });
}

// Spreads speculative image decoding across idle time so menu and battle input
// remain responsive while future screen art is prepared.
export function preloadImagesWhenIdle(srcs: string[]) {
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
function schedulePreloadBatch(callback: () => void) {
  const scheduler = globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };

  scheduler.requestIdleCallback(callback, { timeout: IMAGE_PRELOAD_IDLE_TIMEOUT });

  globalThis.setTimeout(callback, 0);
}
