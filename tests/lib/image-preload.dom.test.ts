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

const { preloadImage, preloadImagesInBatches, resetImagePreloadCache } = await import("@/lib/preload/image");

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

  it("shares one fetch between waiters without cancelling it when a waiter leaves", async () => {
    const src = uniqueUrl();
    const first = new AbortController();
    const one = preloadImage(src, first.signal);
    const two = preloadImage(src);
    expect(mockImageInstances).toHaveLength(1);
    first.abort();
    await one;
    // The shared fetch keeps warming for the remaining waiter.
    expect(mockImageInstances[0].src).toBe(src);
    mockImageInstances[0].onload();
    await two;
    // Completed artwork stays warm without starting another fetch.
    await preloadImage(src);
    expect(mockImageInstances).toHaveLength(1);
  });

  it("releases abandoned decoding without allowing it to replace a newer warmup", async () => {
    const src = uniqueUrl();
    const first = new AbortController();
    const second = new AbortController();
    const one = preloadImage(src, first.signal);
    const two = preloadImage(src, second.signal);
    let finishDecode!: () => void;
    mockImageInstances[0].decode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishDecode = resolve;
        }),
    );
    mockImageInstances[0].onload();
    first.abort();
    await one;
    expect(mockImageInstances[0].src).toBe(src);
    second.abort();
    await two;
    expect(mockImageInstances[0].src).toBe("");
    const replacement = preloadImage(src);
    finishDecode();
    await Promise.resolve();
    const concurrent = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload();
    await Promise.all([replacement, concurrent]);
    await preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
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
    const retry = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload();
    await retry;
  });

  it("bounds completed entries and keeps recently used images warm", async () => {
    const sources = Array.from({ length: 500 }, uniqueUrl);
    const pending = sources.map((src) => preloadImage(src));
    for (const image of mockImageInstances) image.onload();
    await Promise.all(pending);
    const before = mockImageInstances.length;
    // Recently used entries stay warm without a new fetch.
    await preloadImage(sources[0]!);
    expect(mockImageInstances).toHaveLength(before);

    const added = preloadImage(uniqueUrl());
    mockImageInstances.at(-1)!.onload();
    await added;
    await preloadImage(sources[0]!);
    expect(mockImageInstances).toHaveLength(before + 1);
    // The least-recently used entry was evicted and fetches again.
    const evicted = preloadImage(sources[1]!);
    expect(mockImageInstances).toHaveLength(before + 2);
    mockImageInstances.at(-1)!.onload();
    await evicted;
  });

  it("drops pending warmups on reset without letting orphans poison the cache", async () => {
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
    expect(mockImageInstances[0].src).toBe("");
    const replacement = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    finishDecode();
    await old;
    const concurrent = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload();
    await concurrent;
    await replacement;
    // The orphaned first fetch never cached; the replacement did.
    const warmed = mockImageInstances.length;
    await preloadImage(src);
    expect(mockImageInstances).toHaveLength(warmed);
  });

  it("retries an image that is already broken when its source is assigned", async () => {
    vi.stubGlobal("Image", function () {
      const instance = new MockImage();
      instance.complete = true;
      instance.naturalWidth = 0;
      instance.decode = vi.fn().mockRejectedValue(new Error("Broken image"));
      mockImageInstances.push(instance);
      return instance;
    } as unknown as typeof Image);

    await preloadImage("sync-error-test.png");
    const retry = preloadImage("sync-error-test.png");
    expect(mockImageInstances.length).toBe(2);
    await retry;
  });

  it("falls back to onload when image.decode is unavailable", async () => {
    vi.stubGlobal("Image", function () {
      const instance = new MockImage();
      Reflect.deleteProperty(instance, "decode");
      mockImageInstances.push(instance);
      return instance;
    } as unknown as typeof Image);

    const promise = preloadImage("no-decode.png");
    mockImageInstances[0].onload?.();
    await expect(promise).resolves.toBeUndefined();
  });
});

describe("preloadImagesInBatches", () => {
  it("does not start a batch whose owner already aborted", async () => {
    const owner = new AbortController();
    owner.abort();
    const progress = vi.fn();
    await preloadImagesInBatches([uniqueUrl()], 1, progress, owner.signal);
    expect(mockImageInstances).toHaveLength(0);
    expect(progress).not.toHaveBeenCalled();
  });

  it("waits for a bounded batch and yields before starting the next", async () => {
    const frameCallbacks = installRafStub();
    const srcs = [uniqueUrl(), uniqueUrl(), uniqueUrl()];
    const promise = preloadImagesInBatches(srcs, 2);

    expect(mockImageInstances).toHaveLength(2);
    for (const image of mockImageInstances) image.onload();
    await vi.waitFor(() => expect(frameCallbacks).toHaveLength(1));

    frameCallbacks[0]!(performance.now());
    await vi.waitFor(() => expect(mockImageInstances).toHaveLength(3));
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
  });

  it.each(["reset", "abort"] as const)("stops the pipeline on %s without starting later batches", async (kind) => {
    const owner = new AbortController();
    const progress = vi.fn();
    const pending = preloadImagesInBatches([uniqueUrl(), uniqueUrl(), uniqueUrl()], 1, progress, owner.signal);
    expect(mockImageInstances).toHaveLength(1);
    if (kind === "reset") resetImagePreloadCache();
    else owner.abort();
    await pending;
    expect(mockImageInstances).toHaveLength(1);
    expect(progress.mock.calls).toEqual([[0, 3]]);
  });

  it("lets a reset between batches make room for its replacement", async () => {
    const frameCallbacks = installRafStub();
    const src = uniqueUrl();
    const old = preloadImagesInBatches([src, uniqueUrl()], 1);
    mockImageInstances[0].onload();
    await vi.waitFor(() => expect(frameCallbacks).toHaveLength(1));
    resetImagePreloadCache();
    await old;
    const next = preloadImage(src);
    expect(mockImageInstances).toHaveLength(2);
    mockImageInstances[1].onload();
    await next;
  });
});
