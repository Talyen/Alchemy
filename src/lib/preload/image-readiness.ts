import { IMAGE_PRELOAD_TIMEOUT_MS } from "../game-constants";

/** Settles load and decode together; failure or cancellation never rejects. */
export function waitForImage(image: HTMLImageElement, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.removeEventListener("load", decode);
      image.removeEventListener("error", fail);
      signal?.removeEventListener("abort", fail);
      resolve(ready);
    };
    const fail = () => finish(false);
    const decode = () => {
      if (settled) return;
      image.removeEventListener("load", decode);
      try {
        if (typeof image.decode !== "function") finish(image.naturalWidth > 0);
        else void image.decode().then(() => finish(true), fail);
      } catch {
        fail();
      }
    };
    const timeout = globalThis.setTimeout(fail, IMAGE_PRELOAD_TIMEOUT_MS);
    image.addEventListener("load", decode);
    image.addEventListener("error", fail);
    signal?.addEventListener("abort", fail, { once: true });
    if (signal?.aborted) fail();
    else if (image.complete) decode();
  });
}
