import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { installRafStub } from "../helpers/animation-test";
import { IMAGE_PRELOAD_TIMEOUT_MS } from "@/lib/game-constants";

interface MockImage {
  src: string;
  decoding: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  decode: () => Promise<void>;
}

function createMockImage(): MockImage {
  return {
    src: "",
    decoding: "",
    onload: null,
    onerror: null,
    decode: vi.fn().mockResolvedValue(undefined),
  };
}

let urlCounter = 0;
function uniqueUrl(): string {
  return `test-${urlCounter++}.png`;
}

const mockImageInstances: MockImage[] = [];
beforeEach(() => {
  mockImageInstances.length = 0;
  resetImagePreloadCache();

  vi.stubGlobal("Image", function () {
    const instance = createMockImage();
    mockImageInstances.push(instance);
    return instance;
  } as unknown as typeof Image);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const { preloadImage, preloadImagesInBatches, resetImagePreloadCache } = await import("@/lib/image-preload");

describe("preloadImage", () => {
  it("creates an Image and sets decoding to async", async () => {
    const src = uniqueUrl();
    const promise = preloadImage(src);
    expect(mockImageInstances.length).toBe(1);
    expect(mockImageInstances[0].decoding).toBe("async");
    mockImageInstances[0].onload?.();
    await promise;
  });

  it("sets src on the created Image", async () => {
    const src = uniqueUrl();
    const promise = preloadImage(src);
    expect(mockImageInstances[0].src).toBe(src);
    mockImageInstances[0].onload?.();
    await promise;
  });

  it("resolves when image loads successfully", async () => {
    const promise = preloadImage(uniqueUrl());
    mockImageInstances[0].onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves when image errors (no rejection)", async () => {
    const promise = preloadImage(uniqueUrl());
    mockImageInstances[0].onerror?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it("retries an image after a transient load error", async () => {
    const src = uniqueUrl();
    const first = preloadImage(src);
    mockImageInstances[0].onerror?.();
    await first;

    const retry = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload?.();
    await retry;
  });

  it("settles stalled loads at the deadline and allows a retry", async () => {
    vi.useFakeTimers();
    const src = uniqueUrl();
    const stalled = preloadImage(src);

    await vi.advanceTimersByTimeAsync(IMAGE_PRELOAD_TIMEOUT_MS);
    await expect(stalled).resolves.toBeUndefined();

    const retry = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload?.();
    await retry;
  });

  it("allows a retry when browser decoding fails", async () => {
    const src = uniqueUrl();
    const first = preloadImage(src);
    vi.mocked(mockImageInstances[0].decode).mockRejectedValueOnce(new Error("decode failed"));
    mockImageInstances[0].onload?.();
    await first;

    const retry = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload?.();
    await retry;
  });

  it("caches already-loaded images", async () => {
    const src = uniqueUrl();
    const p1 = preloadImage(src);
    mockImageInstances[0].onload?.();
    await p1;

    const p2 = preloadImage(src);
    await expect(p2).resolves.toBeUndefined();
    expect(mockImageInstances.length).toBe(1);
  });

  it("handles empty string safely", async () => {
    await expect(preloadImage("")).resolves.toBeUndefined();
  });

  it("evicts cached entries when resetImagePreloadCache is called", async () => {
    const src = "reset-test.png";
    const p1 = preloadImage(src);
    mockImageInstances[0].onload?.();
    await p1;

    expect(mockImageInstances).toHaveLength(1);
    resetImagePreloadCache();

    const p2 = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload?.();
    await p2;
  });

  it("allows retrying when an error occurs synchronously during instantiation", async () => {
    // Stub Image so setting src immediately triggers onerror synchronously
    vi.stubGlobal("Image", function () {
      let currentSrc = "";
      const instance: MockImage = {
        decoding: "",
        onload: null,
        onerror: null,
        decode: vi.fn().mockResolvedValue(undefined),
        get src() {
          return currentSrc;
        },
        set src(value: string) {
          currentSrc = value;
          // Synchronous error trigger:
          instance.onerror?.();
        },
      };
      mockImageInstances.push(instance);
      return instance;
    } as unknown as typeof Image);

    const src = "sync-error-test.png";
    await preloadImage(src);

    // After synchronous error, retrying should create a new Image, not return a cached failure
    const retry = preloadImage(src);
    expect(mockImageInstances.length).toBe(2);
    await retry;
  });

  it("gracefully falls back to onload when image.decode is undefined", async () => {
    vi.stubGlobal("Image", function () {
      const instance = {
        src: "",
        decoding: "",
        onload: null,
        onerror: null,
        // No decode method
      };
      mockImageInstances.push(instance as unknown as MockImage);
      return instance;
    } as unknown as typeof Image);

    const src = "no-decode.png";
    const promise = preloadImage(src);
    mockImageInstances[0].onload?.();
    await expect(promise).resolves.toBeUndefined();
  });
});

describe("preloadImagesInBatches", () => {
  it("waits for each bounded batch and yields before starting the next", async () => {
    const frameCallbacks = installRafStub();
    const srcs = [uniqueUrl(), uniqueUrl(), uniqueUrl()];
    const promise = preloadImagesInBatches(srcs, 2);

    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[0].onload?.();
    mockImageInstances[1].onload?.();
    await vi.waitFor(() => expect(frameCallbacks).toHaveLength(1));
    expect(mockImageInstances).toHaveLength(2);

    frameCallbacks[0]!(performance.now());
    await vi.waitFor(() => expect(mockImageInstances).toHaveLength(3));
    mockImageInstances[2].onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it("deduplicates sources before warming", async () => {
    const src = uniqueUrl();
    const promise = preloadImagesInBatches([src, src], 2);
    expect(mockImageInstances).toHaveLength(1);
    mockImageInstances[0].onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it("reports per-image progress against the unique total", async () => {
    const reports: Array<[number, number]> = [];
    const srcs = [uniqueUrl(), uniqueUrl(), uniqueUrl()];
    const promise = preloadImagesInBatches(srcs, 8, (loaded, total) => {
      reports.push([loaded, total]);
    });

    expect(reports).toEqual([[0, 3]]);
    mockImageInstances[0].onload?.();
    await vi.waitFor(() => expect(reports).toContainEqual([1, 3]));
    mockImageInstances[1].onload?.();
    mockImageInstances[2].onload?.();
    await expect(promise).resolves.toBeUndefined();
    expect(reports.at(-1)).toEqual([3, 3]);
    expect(reports.map(([loaded]) => loaded)).toEqual([0, 1, 2, 3]);
  });
});
