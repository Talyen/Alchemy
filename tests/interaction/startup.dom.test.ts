import { act, cleanup, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { preloadImagesInBatches } from "@/lib/image-preload";
import { FONT_PRELOAD_TIMEOUT_MS } from "@/lib/game-constants";
import { useInitialLoadReady } from "@/app/use-initial-load-ready";
import { deferred } from "../helpers/deferred";
import { defineSequenceFamily, requireProgress, type Scenario } from "./sequence";
import { advance, installFrames } from "./timing";

vi.mock("@/lib/image-preload", async (original) => ({
  ...(await original<typeof import("@/lib/image-preload")>()),
  preloadImagesInBatches: vi.fn(),
}));
defineSequenceFamily("startup", () => {
  installFrames();
  localStorage.removeItem("alchemy-skip-loading-screen");
  const images = deferred<void>();
  const fonts = deferred<void>();
  const startedAt = Date.now();
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) =>
    errors.push(args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" ")),
  );
  let imageFailed = false;
  let imagesReady = false;
  let fontsReady = false;
  let bootstrapped = false;
  vi.mocked(preloadImagesInBatches).mockImplementation(async (sources, _batch, progress) => {
    await images.promise;
    if (imageFailed) throw new Error("injected image failure");
    progress?.(sources.length, sources.length);
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: fonts.promise } });
  const mounted = renderHook(({ ready }) => useInitialLoadReady({ bootstrapReady: ready, minDurationMs: 200 }), {
    initialProps: { ready: false },
  });
  const observe = () => ({
    imagesReady,
    imageFailed,
    fontsReady,
    bootstrapped,
    fontDeadlineElapsed: Date.now() - startedAt >= FONT_PRELOAD_TIMEOUT_MS,
    errors,
    ...mounted.result.current,
  });
  return {
    fixture: { minimumMs: 200, bootstrapReady: false },
    actions: () => ["images", "image-failure", "fonts", "bootstrap", "frame", "settle"],
    async run(action) {
      await act(async () => {
        if (action === "images" || action === "image-failure") {
          imageFailed = action === "image-failure";
          imagesReady = true;
          images.resolve();
        }
        if (action === "fonts") {
          fontsReady = true;
          fonts.resolve();
        }
        if (action === "bootstrap") {
          bootstrapped = true;
          mounted.rerender({ ready: true });
        }
      });
      if (action === "settle") {
        await advance(5000);
        if (imagesReady && fontsReady && bootstrapped)
          requireProgress(mounted.result.current.ready, "startup-eventual-reveal", observe());
      } else await advance(16);
    },
    check() {
      requireProgress(
        errors.every(
          (message) =>
            message.includes("Font loading timed out") ||
            ((message.startsWith("[other] Essential art preload failed") ||
              message.startsWith("[other] Deferred art preload failed")) &&
              message.includes("injected image failure")),
        ),
        "startup-only-expected-errors",
        errors,
      );
      if (mounted.result.current.ready)
        requireProgress(
          imagesReady && (fontsReady || Date.now() - startedAt >= FONT_PRELOAD_TIMEOUT_MS) && bootstrapped,
          "startup-does-not-bypass-gates",
          observe(),
        );
    },
    observe,
    async settle(this: Scenario) {
      await this.run("settle");
    },
    dispose() {
      mounted.unmount();
      images.resolve();
      fonts.resolve();
      cleanup();
      vi.restoreAllMocks();
      Reflect.deleteProperty(document, "fonts");
      vi.unstubAllGlobals();
      vi.useRealTimers();
    },
  };
});
