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

const { preloadImage, preloadImagesInBatches } = await import("@/lib/image-preload");

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
