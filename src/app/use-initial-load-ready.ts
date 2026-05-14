// Startup readiness gate for the first menu paint.
// Depends on browser image/font readiness APIs and React state/effects.
import { useEffect, useState } from "react";
import { INITIAL_LOAD_MIN_DURATION_MS, INITIAL_LOAD_MAX_DURATION_MS } from "@/lib/game-constants";

type InitialLoadReadyOptions = {
  imageUrls: string[];
  minDurationMs?: number;
  maxDurationMs?: number;
};

// Holds the initial menu until every game asset is decoded so the first visible frame
// feels intentional and no image pop-in occurs during gameplay.
// Enforces a minimum duration (650ms default) so the loading screen is visible long
// enough for the user to register it. If assets take longer, the loading bar loops
// until they complete.
export function useInitialLoadReady({ imageUrls, minDurationMs = INITIAL_LOAD_MIN_DURATION_MS, maxDurationMs = INITIAL_LOAD_MAX_DURATION_MS }: InitialLoadReadyOptions) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function waitForStartupAssets() {
      const startedAt = performance.now();

      await Promise.race([
        Promise.all([
          waitForFonts(),
          ...imageUrls.map((url) => waitForImage(url)),
        ]),
        delay(maxDurationMs),
      ]);

      const elapsed = performance.now() - startedAt;
      if (elapsed < minDurationMs) {
        await delay(minDurationMs - elapsed);
      }

      if (!cancelled) setReady(true);
    }

    waitForStartupAssets();
    return () => { cancelled = true; };
  }, [imageUrls, minDurationMs, maxDurationMs]);

  return ready;
}

function waitForImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
    if (image.complete) {
      image.decode?.().then(() => resolve()).catch(() => { console.warn("Image decode failed:", url); resolve(); });
    }
  });
}

function waitForFonts() {
  if (!("fonts" in document)) return Promise.resolve();
  return document.fonts.ready.then(() => undefined).catch(() => { console.warn("Font loading failed"); return undefined; });
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
