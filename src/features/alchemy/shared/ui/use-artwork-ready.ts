import { useLayoutEffect, useRef, useState } from "react";

import { waitForImage } from "@/lib/preload";

export function useArtworkReady(identity: string | number) {
  const ref = useRef<HTMLDivElement>(null);
  const [readyIdentity, setReadyIdentity] = useState<string | number | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    setReadyIdentity(null);
    const waits = new Map<HTMLImageElement, { source: string; lifetime: AbortController; pending: boolean }>();
    let frame = 0;
    const reconcile = () => {
      cancelAnimationFrame(frame);
      const images = new Set(root.querySelectorAll<HTMLImageElement>("img[src]"));
      for (const [image, wait] of waits) {
        if (!images.has(image) || wait.source !== sourceOf(image)) {
          wait.lifetime.abort();
          waits.delete(image);
        }
      }
      for (const image of images) {
        if (waits.has(image)) continue;
        const wait = { source: sourceOf(image), lifetime: new AbortController(), pending: true };
        waits.set(image, wait);
        image.style.removeProperty("visibility");
        image.loading = "eager";
        void waitForImage(image, wait.lifetime.signal).then((ready) => {
          if (wait.lifetime.signal.aborted) return;
          // Source changes can precede delivery of the mutation observer.
          if (wait.source !== sourceOf(image)) return reconcile();
          wait.pending = false;
          if (!ready) image.style.visibility = "hidden";
          reconcile();
        });
      }
      if ([...waits.values()].some((wait) => wait.pending)) return;
      frame = requestAnimationFrame(() => {
        observer.disconnect();
        setReadyIdentity(identity);
      });
    };
    const observer = new MutationObserver(reconcile);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });
    reconcile();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      for (const wait of waits.values()) wait.lifetime.abort();
    };
  }, [identity]);

  return { ref, pending: readyIdentity !== identity || undefined };
}

function sourceOf(image: HTMLImageElement): string {
  return JSON.stringify([image.getAttribute("src"), image.getAttribute("srcset")]);
}
