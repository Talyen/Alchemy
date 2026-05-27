// Startup readiness gate for the first menu paint.
// Depends on browser image/font readiness APIs and React state/effects.
// When shouldSkipStartupLoadingGate() is true (Playwright storageState alchemy-skip-loading-screen),
// the loading screen is skipped so the menu appears immediately.
import { useEffect, useState } from "react";
import { shouldSkipStartupLoadingGate } from "@/features/alchemy/utils";
import {
  INITIAL_LOAD_MIN_DURATION_MS,
  INITIAL_LOAD_MAX_DURATION_MS,
  INITIAL_LOAD_BATCH_SIZE,
} from "@/lib/game-constants";
import { preloadImage } from "@/lib/image-preload";

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
export function useInitialLoadReady({
  imageUrls,
  minDurationMs = INITIAL_LOAD_MIN_DURATION_MS,
  maxDurationMs = INITIAL_LOAD_MAX_DURATION_MS,
}: InitialLoadReadyOptions) {
  const [ready, setReady] = useState(() => shouldSkipStartupLoadingGate());

  useEffect(() => {
    if (ready) return;
    let cancelled = false;

    async function waitForStartupAssets() {
      const startedAt = performance.now();

      const fontsPromise = waitForFonts();
      const imagesPromise = preloadBatched(imageUrls, INITIAL_LOAD_BATCH_SIZE);

      await Promise.race([Promise.all([fontsPromise, imagesPromise]), delay(maxDurationMs)]);

      const elapsed = performance.now() - startedAt;
      if (elapsed < minDurationMs) {
        await delay(minDurationMs - elapsed);
      }

      if (!cancelled) setReady(true);
    }

    waitForStartupAssets();
    return () => {
      cancelled = true;
    };
  }, [ready, imageUrls, minDurationMs, maxDurationMs]);

  return ready;
}

function waitForFonts() {
  if (!("fonts" in document)) return Promise.resolve();
  return document.fonts.ready
    .then(() => undefined)
    .catch(() => {
      console.warn("Font loading failed");
      return undefined;
    });
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function preloadBatched(urls: string[], batchSize: number) {
  for (let i = 0; i < urls.length; i += batchSize) {
    await Promise.all(urls.slice(i, i + batchSize).map((url) => preloadImage(url)));
    if (i + batchSize < urls.length) {
      await delay(0);
    }
  }
}
