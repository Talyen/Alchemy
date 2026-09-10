import { useLayoutEffect, useRef, useState } from "react";

import { IMAGE_PRELOAD_TIMEOUT_MS } from "@/lib/game-constants";

export function useArtworkReady(identity: string | number) {
  const ref = useRef<HTMLDivElement>(null);
  const [readyIdentity, setReadyIdentity] = useState<string | number | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    setReadyIdentity(null);
    let cancelled = false;
    let frame = 0;
    const cleanups: Array<() => void> = [];
    let generation = 0;
    const waitForArtwork = () => {
      const attempt = ++generation;
      cancelAnimationFrame(frame);
      cleanups.splice(0).forEach((cleanup) => cleanup());
      const images = Array.from(root.querySelectorAll<HTMLImageElement>("img[src]"));
      const pending = images.map(
        (image) =>
          new Promise<void>((resolve) => {
            image.style.removeProperty("visibility");
            let settled = false;
            const finish = (failed = false) => {
              if (settled) return;
              settled = true;
              cleanup();
              if (failed && !cancelled && attempt === generation) image.style.visibility = "hidden";
              resolve();
            };
            const decode = () => {
              if (typeof image.decode !== "function") {
                finish(image.naturalWidth === 0);
                return;
              }
              void image.decode().then(
                () => finish(),
                () => finish(true),
              );
            };
            const fail = () => finish(true);
            const timeout = window.setTimeout(fail, IMAGE_PRELOAD_TIMEOUT_MS);
            const cleanup = () => {
              window.clearTimeout(timeout);
              image.removeEventListener("load", decode);
              image.removeEventListener("error", fail);
            };
            cleanups.push(cleanup);
            image.loading = "eager";
            image.addEventListener("load", decode);
            image.addEventListener("error", fail);
            if (image.complete) decode();
          }),
      );
      void Promise.all(pending).then(() => {
        if (cancelled || attempt !== generation) return;
        frame = requestAnimationFrame(() => {
          if (cancelled || attempt !== generation) return;
          observer.disconnect();
          setReadyIdentity(identity);
        });
      });
    };
    const observer = new MutationObserver(waitForArtwork);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });
    waitForArtwork();
    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [identity]);

  return { ref, pending: readyIdentity !== identity || undefined };
}
