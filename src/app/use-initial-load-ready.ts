// Startup readiness gate for the first menu paint.
// The loading bar dismisses after a short minimum delay; images are streamed in the
// background via idle-time preloading so the user never waits for a full decode pass.
// When shouldSkipStartupLoadingGate() is true (Playwright), the gate is skipped entirely.
import { useEffect, useState } from "react";
import { shouldSkipStartupLoadingGate } from "@/features/alchemy/shared/utils";
import { INITIAL_LOAD_MIN_DURATION_MS } from "@/lib/game-constants";
import { preloadImagesWhenIdle } from "@/lib/image-preload";
import { allGameArt } from "@/lib/game-data";

// Holds the initial menu for a minimum duration so the loading bar is visible long
// enough for the user to register it.  Meanwhile, every game asset is preloaded in the
// background via idle-time callbacks so that images are typically decoded before the
// user has navigated to a screen that needs them.
export function useInitialLoadReady({ minDurationMs = INITIAL_LOAD_MIN_DURATION_MS } = {}) {
  const [ready, setReady] = useState(() => shouldSkipStartupLoadingGate());

  useEffect(() => {
    if (ready) return;
    let cancelled = false;

    preloadImagesWhenIdle(allGameArt);

    void waitForFonts().then(() => undefined);

    const timer = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, minDurationMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, minDurationMs]);

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
