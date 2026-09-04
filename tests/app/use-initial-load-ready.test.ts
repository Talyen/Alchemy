import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadImagesInBatches } from "@/lib/image-preload";
import { FONT_PRELOAD_TIMEOUT_MS, IMAGE_PRELOAD_BATCH_SIZE, STARTUP_BAR_INCOMPLETE_CAP } from "@/lib/game-constants";
import { shouldSkipStartupLoadingGate } from "@/features/alchemy/shared/utils";
import { useInitialLoadReady } from "@/app/use-app-effects";

vi.mock("@/lib/game-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/game-data")>()),
  allGameArt: ["first.webp", "second.webp", "gear.webp"],
  essentialGameArt: ["first.webp", "second.webp"],
}));

vi.mock("@/lib/image-preload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image-preload")>()),
  preloadImagesInBatches: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/alchemy/shared/utils")>()),
  shouldSkipStartupLoadingGate: vi.fn(),
}));

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

describe("useInitialLoadReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16) as unknown as number;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      window.clearTimeout(id);
    });
    vi.mocked(shouldSkipStartupLoadingGate).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, "fonts");
  });

  it("waits for art, fonts, bootstrap, the minimum, and the bar to catch up before revealing", async () => {
    const images = deferred();
    const fonts = deferred();
    vi.mocked(preloadImagesInBatches).mockImplementation(async (_srcs, _batchSize, onProgress) => {
      onProgress?.(0, 2);
      await images.promise;
      onProgress?.(2, 2);
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: fonts.promise },
    });

    const { result } = renderHook(() => useInitialLoadReady({ minDurationMs: 2000, bootstrapReady: true }));

    expect(preloadImagesInBatches).toHaveBeenCalledWith(
      ["first.webp", "second.webp"],
      IMAGE_PRELOAD_BATCH_SIZE,
      expect.any(Function),
    );
    expect(result.current.ready).toBe(false);

    await advance(2000);
    expect(result.current.ready).toBe(false);

    await act(async () => {
      images.resolve();
      await images.promise;
    });
    expect(result.current.ready).toBe(false);

    await act(async () => {
      fonts.resolve();
      await fonts.promise;
    });
    expect(result.current.ready).toBe(false);

    await advance(2000);
    expect(result.current.ready).toBe(true);
    expect(result.current.progress).toBeGreaterThan(0.99);
  });

  it("keeps the bar below full while bootstrap is still pending", async () => {
    vi.mocked(preloadImagesInBatches).mockImplementation(async (_srcs, _batchSize, onProgress) => {
      onProgress?.(2, 2);
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });

    const { result, rerender } = renderHook(
      ({ bootstrapReady }: { bootstrapReady: boolean }) => useInitialLoadReady({ minDurationMs: 2000, bootstrapReady }),
      { initialProps: { bootstrapReady: false } },
    );

    await advance(2500);
    expect(result.current.ready).toBe(false);
    expect(result.current.progress).toBeLessThanOrEqual(STARTUP_BAR_INCOMPLETE_CAP);

    rerender({ bootstrapReady: true });
    await advance(2000);
    expect(result.current.ready).toBe(true);
    expect(result.current.progress).toBeGreaterThan(0.99);
  });

  it("moves displayed progress as image decode reports arrive", async () => {
    const images = deferred();
    vi.mocked(preloadImagesInBatches).mockImplementation(async (_srcs, _batchSize, onProgress) => {
      onProgress?.(1, 2);
      await images.promise;
      onProgress?.(2, 2);
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise<void>(() => {}) },
    });

    const { result } = renderHook(() => useInitialLoadReady({ minDurationMs: 2000, bootstrapReady: true }));

    await advance(400);
    expect(result.current.ready).toBe(false);
    expect(result.current.progress).toBeGreaterThan(0);
    expect(result.current.progress).toBeLessThan(STARTUP_BAR_INCOMPLETE_CAP);
  });

  it("continues startup when font readiness never settles", async () => {
    vi.mocked(preloadImagesInBatches).mockImplementation(async (_srcs, _batchSize, onProgress) => {
      onProgress?.(2, 2);
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise<void>(() => {}) },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useInitialLoadReady({ minDurationMs: 0, bootstrapReady: true }));

    await advance(FONT_PRELOAD_TIMEOUT_MS);
    await advance(2000);

    expect(result.current.ready).toBe(true);
    expect(result.current.progress).toBe(1);
    expect(warn).toHaveBeenCalledWith("Font loading timed out");
  });

  it("starts deferred gear decode while the minimum display window is still running", async () => {
    const essential = deferred();
    vi.mocked(preloadImagesInBatches).mockImplementation(async (srcs, _batchSize, onProgress) => {
      if (srcs.includes("gear.webp")) return;
      onProgress?.(0, 2);
      await essential.promise;
      onProgress?.(2, 2);
    });
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });

    const { result } = renderHook(() => useInitialLoadReady({ minDurationMs: 2000, bootstrapReady: true }));
    expect(result.current.ready).toBe(false);

    await act(async () => {
      essential.resolve();
      await essential.promise;
    });
    await advance(500);

    expect(preloadImagesInBatches).toHaveBeenCalledWith(["gear.webp"], IMAGE_PRELOAD_BATCH_SIZE);
    expect(result.current.ready).toBe(false);

    await advance(2000);
    expect(result.current.ready).toBe(true);
  });

  it("keeps warming assets when the test-only presentation gate is skipped", () => {
    vi.mocked(shouldSkipStartupLoadingGate).mockReturnValue(true);
    vi.mocked(preloadImagesInBatches).mockReturnValue(new Promise<void>(() => {}));
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise<void>(() => {}) },
    });

    const { result } = renderHook(() => useInitialLoadReady({ minDurationMs: 2000 }));

    expect(result.current.ready).toBe(true);
    expect(result.current.progress).toBe(1);
    expect(preloadImagesInBatches).toHaveBeenCalledWith(["first.webp", "second.webp"], IMAGE_PRELOAD_BATCH_SIZE);
  });
});
