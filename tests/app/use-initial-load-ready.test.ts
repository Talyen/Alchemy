// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadImages } from "@/lib/image-preload";
import { shouldSkipStartupLoadingGate } from "@/features/alchemy/shared/utils";
import { useInitialLoadReady } from "@/app/use-app-effects";

vi.mock("@/lib/game-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/game-data")>()),
  allGameArt: ["first.webp", "second.webp"],
}));

vi.mock("@/lib/image-preload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image-preload")>()),
  preloadImages: vi.fn(),
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

describe("useInitialLoadReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(shouldSkipStartupLoadingGate).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "fonts");
  });

  it("waits for the fixed minimum, all game art, and fonts before revealing the app", async () => {
    const images = deferred();
    const fonts = deferred();
    vi.mocked(preloadImages).mockReturnValue(images.promise);
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: fonts.promise },
    });

    const { result } = renderHook(() => useInitialLoadReady({ minDurationMs: 650 }));

    expect(preloadImages).toHaveBeenCalledWith(["first.webp", "second.webp"]);
    expect(result.current).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });
    expect(result.current).toBe(false);

    await act(async () => {
      images.resolve();
      await images.promise;
    });
    expect(result.current).toBe(false);

    await act(async () => {
      fonts.resolve();
      await fonts.promise;
    });
    expect(result.current).toBe(true);
  });

  it("keeps warming assets when the test-only presentation gate is skipped", () => {
    vi.mocked(shouldSkipStartupLoadingGate).mockReturnValue(true);
    vi.mocked(preloadImages).mockReturnValue(new Promise<void>(() => {}));
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise<void>(() => {}) },
    });

    const { result } = renderHook(() => useInitialLoadReady({ minDurationMs: 650 }));

    expect(result.current).toBe(true);
    expect(preloadImages).toHaveBeenCalledWith(["first.webp", "second.webp"]);
  });
});
