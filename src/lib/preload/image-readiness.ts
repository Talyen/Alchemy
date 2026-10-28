import { IMAGE_PRELOAD_TIMEOUT_MS } from "../game-constants";

/** Settles load and decode together; failure or cancellation never rejects. */
export function waitForImage(image: HTMLImageElement, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let decoding = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onFail);
      signal?.removeEventListener("abort", onFail);
      resolve(ready);
    };
    const onFail = () => finish(false);
    const onLoad = () => {
      if (settled || decoding) return;
      decoding = true;
      try {
        if (typeof image.decode !== "function") finish(image.naturalWidth > 0);
        else void image.decode().then(() => finish(true), onFail);
      } catch {
        onFail();
      }
    };
    const timeout = globalThis.setTimeout(onFail, IMAGE_PRELOAD_TIMEOUT_MS);
    image.addEventListener("load", onLoad);
    image.addEventListener("error", onFail);
    signal?.addEventListener("abort", onFail, { once: true });
    if (signal?.aborted) onFail();
    else if (image.complete) onLoad();
  });
}
