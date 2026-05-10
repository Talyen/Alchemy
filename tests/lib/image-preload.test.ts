import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

type MockImage = {
  src: string;
  decoding: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  decode: () => Promise<void>;
};

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
const idleCallbacks: Array<() => void> = [];

beforeEach(() => {
  mockImageInstances.length = 0;
  idleCallbacks.length = 0;

  vi.stubGlobal("Image", function () {
    const instance = createMockImage();
    mockImageInstances.push(instance);
    return instance;
  } as unknown as typeof Image);

  vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
    idleCallbacks.push(cb);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const { preloadImage, preloadImages, preloadImagesWhenIdle } = await import("@/lib/image-preload");

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

  it("caches already-loaded images", async () => {
    const src = uniqueUrl();
    const p1 = preloadImage(src);
    mockImageInstances[0].onload?.();
    await p1;

    const p2 = preloadImage(src);
    await expect(p2).resolves.toBeUndefined();
    expect(mockImageInstances.length).toBe(1);
  });
});

describe("preloadImages", () => {
  it("calls preloadImage for each src", () => {
    const srcs = [uniqueUrl(), uniqueUrl(), uniqueUrl()];
    preloadImages(srcs);
    expect(mockImageInstances.length).toBe(3);
    expect(mockImageInstances[0].src).toBe(srcs[0]);
    expect(mockImageInstances[1].src).toBe(srcs[1]);
    expect(mockImageInstances[2].src).toBe(srcs[2]);
  });
});

describe("preloadImagesWhenIdle", () => {
  it("schedules a batch via requestIdleCallback", () => {
    preloadImagesWhenIdle([uniqueUrl()]);
    expect(idleCallbacks.length).toBe(1);
  });

  it("loads first batch when idle callback fires", () => {
    const srcs = [uniqueUrl(), uniqueUrl(), uniqueUrl(), uniqueUrl(), uniqueUrl()];
    preloadImagesWhenIdle(srcs);
    expect(idleCallbacks.length).toBe(1);
    idleCallbacks[0]();
    expect(mockImageInstances.length).toBe(4);
  });

  it("loads all images across multiple batches", () => {
    const srcs = [uniqueUrl(), uniqueUrl(), uniqueUrl(), uniqueUrl(), uniqueUrl()];
    preloadImagesWhenIdle(srcs);
    idleCallbacks[0]();
    expect(idleCallbacks.length).toBe(2);
    idleCallbacks[1]();
    expect(mockImageInstances.length).toBe(5);
  });

  it("deduplicates srcs", () => {
    const src = uniqueUrl();
    preloadImagesWhenIdle([src, src, uniqueUrl()]);
    idleCallbacks[0]();
    expect(mockImageInstances.length).toBe(2);
  });

  it("filters out empty srcs", () => {
    preloadImagesWhenIdle([uniqueUrl(), "", uniqueUrl()]);
    idleCallbacks[0]();
    expect(mockImageInstances.length).toBe(2);
  });

  it("falls back to setTimeout when requestIdleCallback is not available", async () => {
    vi.unstubAllGlobals();
    const timeoutCallbacks: Array<() => void> = [];
    vi.stubGlobal("setTimeout", (cb: () => void) => {
      timeoutCallbacks.push(cb);
    });

    const { preloadImagesWhenIdle: idleFallback } = await import("@/lib/image-preload");
    idleFallback([uniqueUrl()]);
    expect(timeoutCallbacks.length).toBe(1);
  });
});
