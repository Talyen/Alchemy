// Startup readiness gate for the first menu paint.
// Depends on browser image/font readiness APIs and React state/effects.
import { useEffect, useState } from "react";

type InitialLoadReadyOptions = {
  imageUrls: string[];
  minDurationMs?: number;
  maxDurationMs?: number;
};

// Holds the initial menu until key visual assets are decoded so the first visible frame
// feels intentional instead of letting the logo and layout pop into place.
export function useInitialLoadReady({ imageUrls, minDurationMs = 650, maxDurationMs = 1800 }: InitialLoadReadyOptions) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function waitForStartupAssets() {
      const startedAt = performance.now();
      await Promise.race([
        Promise.all([waitForImages(imageUrls), waitForFonts()]),
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

function waitForImages(urls: string[]) {
  return Promise.all(urls.map((url) => waitForImage(url))).then(() => undefined);
}

function waitForImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
    if (image.complete) {
      image.decode?.().then(() => resolve()).catch(() => resolve());
    }
  });
}

function waitForFonts() {
  if (!("fonts" in document)) return Promise.resolve();
  return document.fonts.ready.then(() => undefined).catch(() => undefined);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
