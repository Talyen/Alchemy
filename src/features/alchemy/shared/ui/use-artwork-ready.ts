import { useLayoutEffect, useRef, useState } from "react";

import { waitForImage } from "@/lib/preload";

export function useArtworkReady(identity: string | number, { initialRevealOnly = false } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [readyIdentity, setReadyIdentity] = useState<string | number | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    setReadyIdentity(null);
    const waits = new Map<HTMLImageElement, { source: string; lifetime: AbortController; pending: boolean }>();
    let revealed = false;
    let frame: number | null = null;
    const hasPendingArtwork = () => {
      for (const wait of waits.values()) if (wait.pending) return true;
      return false;
    };
    const scheduleReveal = () => {
      if (hasPendingArtwork() || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        revealed = true;
        setReadyIdentity(identity);
      });
    };
    const reconcile = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
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
        if (initialRevealOnly && revealed) image.style.visibility = "hidden";
        image.loading = "eager";
        void waitForImage(image, wait.lifetime.signal).then((ready) => {
          if (wait.lifetime.signal.aborted) return;
          // Source changes can precede delivery of the mutation observer.
          if (wait.source !== sourceOf(image)) return reconcile();
          wait.pending = false;
          if (!ready) image.style.visibility = "hidden";
          else image.style.removeProperty("visibility");
          // Decode completions change readiness, not the mounted image set.
          // The observer handles DOM/source changes before the reveal frame.
          scheduleReveal();
        });
      }
      if (hasPendingArtwork() && (!initialRevealOnly || !revealed)) setReadyIdentity(null);
      scheduleReveal();
    };
    const observer = new MutationObserver((records) => {
      // Text, icons and combat counters change frequently inside a screen.
      // Only image sources or subtrees containing images can change readiness.
      if (records.some(affectsArtwork)) reconcile();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcset"] });
    reconcile();
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      for (const wait of waits.values()) wait.lifetime.abort();
    };
  }, [identity, initialRevealOnly]);

  return { ref, pending: readyIdentity !== identity || undefined };
}

function containsArtwork(node: Node): boolean {
  return node instanceof Element && (node.matches("img") || node.querySelector("img") !== null);
}

function affectsArtwork(record: MutationRecord): boolean {
  if (record.type === "attributes") return record.target instanceof HTMLImageElement;
  for (const node of record.addedNodes) {
    if (containsArtwork(node)) return true;
  }
  for (const node of record.removedNodes) {
    if (containsArtwork(node)) return true;
  }
  return false;
}

function sourceOf(image: HTMLImageElement): string {
  return JSON.stringify([image.getAttribute("src"), image.getAttribute("srcset")]);
}
