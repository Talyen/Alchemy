import { useEffect, useRef, useState } from "react";
import { advanceStartupLoad, createStartupLoadState, type StartupLoadEvent } from "./startup-load-state";
import { IMAGE_PRELOAD_BATCH_SIZE, FONT_PRELOAD_TIMEOUT_MS, INITIAL_LOAD_MIN_DURATION_MS } from "@/lib/game-constants";
import { logError } from "@/lib/error-logger";
import { allGameArt, essentialGameArt } from "@/lib/game-data";
import { preloadImagesInBatches } from "@/lib/image-preload";
import { shouldSkipStartupLoadingGate } from "@/features/alchemy/shared/utils";
import { markStartupReady } from "@/lib/performance/startup-marks";

export function useInitialLoadReady({
  minDurationMs = INITIAL_LOAD_MIN_DURATION_MS,
  bootstrapReady = false,
}: {
  minDurationMs?: number;
  bootstrapReady?: boolean;
} = {}) {
  const skipGate = shouldSkipStartupLoadingGate();
  const publishLoadEventRef = useRef<((event: StartupLoadEvent) => void) | null>(null);
  const initialBootstrapReadyRef = useRef(bootstrapReady);

  const [ready, setReady] = useState(() => skipGate);
  const [progress, setProgress] = useState(() => (skipGate ? 1 : 0));

  useEffect(() => {
    publishLoadEventRef.current?.({ type: "bootstrap-ready", ready: bootstrapReady });
  }, [bootstrapReady]);

  useEffect(() => {
    let cancelled = false;
    const fontsAbort = new AbortController();

    function preloadDeferredGearArt() {
      if (cancelled) return;
      const essential = new Set(essentialGameArt);
      const deferred = allGameArt.filter((src) => !essential.has(src));
      if (deferred.length === 0) return;
      void preloadImagesInBatches(deferred, IMAGE_PRELOAD_BATCH_SIZE).catch((error: unknown) => {
        logError("Deferred art preload failed", "other", { error: String(error) });
      });
    }

    function preloadEssentialArt(onProgress?: (loaded: number, total: number) => void, onSettled?: () => void) {
      const preload = onProgress
        ? preloadImagesInBatches(essentialGameArt, IMAGE_PRELOAD_BATCH_SIZE, onProgress)
        : preloadImagesInBatches(essentialGameArt, IMAGE_PRELOAD_BATCH_SIZE);
      void (async () => {
        try {
          await preload;
        } catch (error) {
          logError("Essential art preload failed", "other", { error: String(error) });
        } finally {
          if (!cancelled) {
            onSettled?.();
            preloadDeferredGearArt();
          }
        }
      })();
    }

    if (skipGate) {
      markStartupReady();
      preloadEssentialArt();
      void waitForFonts(fontsAbort.signal);
      return () => {
        cancelled = true;
        fontsAbort.abort();
      };
    }

    let loadState = createStartupLoadState(essentialGameArt.filter(Boolean).length, initialBootstrapReadyRef.current);
    let rafId = 0;
    let published = -1;

    function apply(event: StartupLoadEvent) {
      if (cancelled) return;
      const wasReady = loadState.ready;
      loadState = advanceStartupLoad(loadState, event);
      if (event.type === "frame") {
        const quantized = Math.round(loadState.display * 192) / 192;
        if (quantized !== published) {
          published = quantized;
          setProgress(quantized);
        }
      }
      if (!wasReady && loadState.ready) {
        setProgress(1);
        markStartupReady();
        setReady(true);
      }
    }

    function tick(timestamp: number) {
      apply({ type: "frame", timestamp });
      if (cancelled || loadState.ready) return;
      rafId = window.requestAnimationFrame(tick);
    }

    publishLoadEventRef.current = apply;
    rafId = window.requestAnimationFrame(tick);
    const timer = window.setTimeout(() => {
      apply({ type: "minimum-elapsed" });
    }, minDurationMs);

    preloadEssentialArt(
      (loaded, total) => apply({ type: "image-progress", loaded, total }),
      () => apply({ type: "images-settled" }),
    );

    void waitForFonts(fontsAbort.signal).then(() => {
      apply({ type: "fonts-settled" });
    });

    return () => {
      cancelled = true;
      publishLoadEventRef.current = null;
      fontsAbort.abort();
      window.clearTimeout(timer);
      window.cancelAnimationFrame(rafId);
    };
  }, [skipGate, minDurationMs]);

  return { ready, progress };
}

function waitForFonts(signal: AbortSignal) {
  if (!("fonts" in document)) return Promise.resolve();
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (warning?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      if (warning) console.warn(warning);
      resolve();
    };
    const onAbort = () => finish();
    const timeout = window.setTimeout(() => finish("Font loading timed out"), FONT_PRELOAD_TIMEOUT_MS);
    signal.addEventListener("abort", onAbort, { once: true });
    void document.fonts.ready.then(
      () => finish(),
      () => finish("Font loading failed"),
    );
  });
}
