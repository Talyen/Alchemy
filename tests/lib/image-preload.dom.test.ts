import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { installRafStub } from "../helpers/animation-test";
import { IMAGE_PRELOAD_TIMEOUT_MS } from "@/lib/game-constants";

class MockImage extends EventTarget {
  src = "";
  decoding = "";
  complete = false;
  naturalWidth = 1;
  decode = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  onload = () => this.dispatchEvent(new Event("load"));
  onerror = () => this.dispatchEvent(new Event("error"));
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
    const instance = new MockImage();
    mockImageInstances.push(instance);
    return instance;
  } as unknown as typeof Image);
});

afterEach(() => {
  resetImagePreloadCache();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const { preloadImage, preloadImagesInBatches, resetImagePreloadCache } = await import("@/lib/image-preload");

describe("preloadImage", () => {
  it("warms the source and waits for decoding before settling", async () => {
    const src = uniqueUrl();
    const promise = preloadImage(src);
    const image = mockImageInstances[0];
    expect(image).toMatchObject({ src, decoding: "async" });
    let decoded!: () => void;
    image.decode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          decoded = resolve;
        }),
    );
    const settled = vi.fn();
    void promise.then(settled);
    image.onload?.();
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    decoded();
    await expect(promise).resolves.toBeUndefined();
  });

  it.each(["load", "decode", "timeout"] as const)("releases a failed %s warmup and allows a retry", async (failure) => {
    vi.useFakeTimers();
    const src = uniqueUrl();
    const first = preloadImage(src);
    const failedImage = mockImageInstances[0];
    if (failure === "load") failedImage.onerror();
    else if (failure === "decode") {
      failedImage.decode.mockRejectedValueOnce(new Error("decode failed"));
      failedImage.onload();
    } else await vi.advanceTimersByTimeAsync(IMAGE_PRELOAD_TIMEOUT_MS);
    await expect(first).resolves.toBeUndefined();
    expect(failedImage.src).toBe("");
    expect(vi.getTimerCount()).toBe(0);
    const retry = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload();
    await retry;
  });

  it("keeps concurrent loads deduplicated beyond the completed cache capacity", async () => {
    const sources = Array.from({ length: 501 }, uniqueUrl);
    const pending = sources.map(preloadImage);
    expect(preloadImage(sources[0]!)).toBe(pending[0]);
    expect(mockImageInstances).toHaveLength(501);
    for (const image of mockImageInstances) image.onload();
    await Promise.all(pending);
  });

  it("bounds completed entries and keeps recently used images warm", async () => {
    const sources = Array.from({ length: 500 }, uniqueUrl);
    const pending = sources.map(preloadImage);
    for (const image of mockImageInstances) image.onload();
    await Promise.all(pending);
    expect(preloadImage(sources[0]!)).toBe(pending[0]);

    const added = preloadImage(uniqueUrl());
    mockImageInstances.at(-1)!.onload();
    await added;
    expect(preloadImage(sources[0]!)).toBe(pending[0]);
    const evicted = preloadImage(sources[1]!);
    expect(mockImageInstances).toHaveLength(502);
    mockImageInstances.at(-1)!.onload();
    await evicted;
  });

  it("releases pending warmups and their timers immediately on reset", async () => {
    vi.useFakeTimers();
    const sources = Array.from({ length: 3 }, uniqueUrl);
    const pending = sources.map(preloadImage);
    expect(vi.getTimerCount()).toBe(3);
    resetImagePreloadCache();
    await Promise.all(pending);
    expect(vi.getTimerCount()).toBe(0);
    expect(mockImageInstances.every((image) => image.src === "")).toBe(true);
    for (const image of mockImageInstances) image.onload();
    expect(mockImageInstances.every((image) => image.decode.mock.calls.length === 0)).toBe(true);
  });

  it("does not let an old decode completion cache or evict a replacement after reset", async () => {
    const src = uniqueUrl();
    const old = preloadImage(src);
    let finishDecode!: () => void;
    mockImageInstances[0].decode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishDecode = resolve;
        }),
    );
    mockImageInstances[0].onload();
    resetImagePreloadCache();
    const replacement = preloadImage(src);
    finishDecode();
    await old;
    expect(preloadImage(src)).toBe(replacement);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload();
    await replacement;
    expect(preloadImage(src)).toBe(replacement);
  });

  it("allows retrying an image that is already broken when its source is assigned", async () => {
    vi.stubGlobal("Image", function () {
      const instance = new MockImage();
      instance.complete = true;
      instance.naturalWidth = 0;
      instance.decode = vi.fn().mockRejectedValue(new Error("Broken image"));
      mockImageInstances.push(instance);
      return instance;
    } as unknown as typeof Image);

    const src = "sync-error-test.png";
    await preloadImage(src);

    const retry = preloadImage(src);
    expect(mockImageInstances.length).toBe(2);
    await retry;
  });

  it("gracefully falls back to onload when image.decode is undefined", async () => {
    vi.stubGlobal("Image", function () {
      const instance = new MockImage();
      Reflect.deleteProperty(instance, "decode");
      mockImageInstances.push(instance);
      return instance;
    } as unknown as typeof Image);

    const src = "no-decode.png";
    const promise = preloadImage(src);
    mockImageInstances[0].onload?.();
    await expect(promise).resolves.toBeUndefined();
  });
});

describe("preloadImagesInBatches", () => {
  it.each([2, NaN])("waits for a bounded batch of %s and yields before starting the next", async (batchSize) => {
    const capacity = Number.isNaN(batchSize) ? 4 : batchSize;
    const frameCallbacks = installRafStub();
    const srcs = Array.from({ length: capacity + 1 }, uniqueUrl);
    const promise = preloadImagesInBatches(srcs, batchSize);

    expect(mockImageInstances).toHaveLength(capacity);
    for (const image of mockImageInstances) image.onload();
    await vi.waitFor(() => expect(frameCallbacks).toHaveLength(1));
    expect(mockImageInstances).toHaveLength(capacity);

    frameCallbacks[0]!(performance.now());
    await vi.waitFor(() => expect(mockImageInstances).toHaveLength(capacity + 1));
    mockImageInstances.at(-1)!.onload();
    await expect(promise).resolves.toBeUndefined();
  });

  it("reports per-image progress against the unique total", async () => {
    const reports: Array<[number, number]> = [];
    const srcs = [uniqueUrl(), uniqueUrl(), uniqueUrl()];
    const promise = preloadImagesInBatches([...srcs, srcs[0]!, ""], 8, (loaded, total) => {
      reports.push([loaded, total]);
    });

    expect(reports).toEqual([[0, 3]]);
    expect(mockImageInstances).toHaveLength(3);
    mockImageInstances[0].onload?.();
    await vi.waitFor(() => expect(reports).toContainEqual([1, 3]));
    mockImageInstances[1].onload?.();
    mockImageInstances[2].onload?.();
    await expect(promise).resolves.toBeUndefined();
    expect(reports.at(-1)).toEqual([3, 3]);
    expect(reports.map(([loaded]) => loaded)).toEqual([0, 1, 2, 3]);
  });
});
