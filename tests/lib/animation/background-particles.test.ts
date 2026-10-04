import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startBackgroundParticles } from "@/lib/animation/background-particles";

const disconnectObserver = vi.fn();
const cleanups: Array<() => void> = [];

function startParticles(...args: Parameters<typeof startBackgroundParticles>) {
  const cleanup = startBackgroundParticles(...args);
  cleanups.push(cleanup);
  return cleanup;
}

let resizeObserverCallback: ResizeObserverCallback | null = null;

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect = disconnectObserver;
}

beforeEach(() => {
  resizeObserverCallback = null;
  disconnectObserver.mockClear();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal("devicePixelRatio", 1);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeMockCanvas(
  mockCtx?: Partial<CanvasRenderingContext2D>,
  dimensions: { width: number; height: number } = { width: 1920, height: 1080 },
) {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    setTransform: vi.fn(),
    globalAlpha: 1,
    fillStyle: "",
    ...mockCtx,
  };
  const canvas = {
    width: 0,
    height: 0,
    style: { width: "", height: "" },
    getContext: vi.fn(() => ctx) as (ctxType: string) => CanvasRenderingContext2D | null,
  };
  const parent = {
    clientWidth: dimensions.width,
    clientHeight: dimensions.height,
    getBoundingClientRect: vi.fn(() => ({ width: dimensions.width, height: dimensions.height })),
  };
  Object.defineProperty(canvas, "parentElement", { value: parent });
  return { canvas, ctx, parent } as unknown as {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    parent: HTMLElement;
  };
}

describe("startBackgroundParticles", () => {
  it("sets a shared color once per frame while preserving every particle draw", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.spyOn(performance, "now").mockReturnValue(0);
    const { canvas, ctx } = makeMockCanvas(undefined, { width: 200, height: 100 });
    let color = "";
    const setColor = vi.fn((value: string) => {
      color = value;
    });
    Object.defineProperty(ctx, "fillStyle", { get: () => color, set: setColor });
    const draws: Array<{ color: string; alpha: number }> = [];
    vi.mocked(ctx.fill).mockImplementation(() => {
      draws.push({ color, alpha: ctx.globalAlpha });
    });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((frame) => {
      frames.push(frame);
      return frames.length;
    });
    const stop = startParticles({ current: canvas }, "dust");
    frames[0]!(16.67);
    expect(setColor).toHaveBeenCalledTimes(1);
    expect(draws).toEqual(Array.from({ length: 20 }, () => ({ color: "rgba(200, 190, 175, 1)", alpha: 0.065 })));
    const x = 100 + Math.sin(Math.PI + 16.67 * 0.001 * 0.4) * 0.3;
    expect(ctx.arc).toHaveBeenCalledTimes(20);
    expect(ctx.arc).toHaveBeenLastCalledWith(x, 47.5, 4.5, 0, Math.PI * 2);
    color = "reset by resize";
    frames[1]!(33.34);
    expect(setColor).toHaveBeenCalledTimes(2);
    expect(draws).toHaveLength(40);
    expect(draws[20]?.color).toBe("rgba(200, 190, 175, 1)");
    stop();
  });

  it("does not clear the backing store on unchanged resize notifications", () => {
    const { canvas, parent } = makeMockCanvas();
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    let width = 0;
    let height = 0;
    const writeWidth = vi.fn((value: number) => {
      width = value;
    });
    const writeHeight = vi.fn((value: number) => {
      height = value;
    });
    Object.defineProperty(canvas, "width", { get: () => width, set: writeWidth });
    Object.defineProperty(canvas, "height", { get: () => height, set: writeHeight });
    const stop = startParticles({ current: canvas }, "embers");
    resizeObserverCallback?.([], {} as ResizeObserver);
    resizeObserverCallback?.([], {} as ResizeObserver);
    expect(writeWidth).toHaveBeenCalledTimes(1);
    expect(writeHeight).toHaveBeenCalledTimes(1);
    Object.defineProperty(parent, "clientWidth", { value: 1280 });
    resizeObserverCallback?.([], {} as ResizeObserver);
    expect(canvas.width).toBe(1280);
    expect(writeWidth).toHaveBeenCalledTimes(2);
    expect(writeHeight).toHaveBeenCalledTimes(1);
    stop();
  });

  it("caps the rendered-pixel backing store to protect high-DPR frame pacing", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const { canvas } = makeMockCanvas();
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);

    const cleanup = startParticles({ current: canvas } as never, "embers");

    expect(canvas.width * canvas.height).toBeLessThanOrEqual(3_000_000);
    expect(canvas.width).toBeGreaterThan(1920);
    expect(canvas.height).toBeGreaterThan(1080);
    cleanup();
    rafSpy.mockRestore();
  });

  it("keeps a 4K high-DPR backing store within the rendered-pixel budget", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const { canvas, ctx } = makeMockCanvas(undefined, { width: 3840, height: 2160 });
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);

    const cleanup = startParticles({ current: canvas } as never, "embers");

    expect(canvas.width * canvas.height).toBeLessThanOrEqual(3_000_000);
    expect(canvas.width).toBeLessThan(3840);
    expect(canvas.height).toBeLessThan(2160);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(canvas.width / 3840, 0, 0, canvas.height / 2160, 0, 0);
    cleanup();
    rafSpy.mockRestore();
  });

  it("waits for a visible size before creating and drawing particles", () => {
    const { canvas, ctx, parent } = makeMockCanvas(undefined, { width: 0, height: 0 });
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);

    const cleanup = startParticles({ current: canvas } as never, "embers");

    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
    expect(rafSpy).not.toHaveBeenCalled();

    Object.defineProperties(parent, {
      clientWidth: { value: 800, configurable: true },
      clientHeight: { value: 600, configurable: true },
    });
    resizeObserverCallback?.([], {} as ResizeObserver);

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(ctx.setTransform).toHaveBeenLastCalledWith(1, 0, 0, 1, 0, 0);
    expect(rafSpy).toHaveBeenCalledOnce();
    cleanup();
    rafSpy.mockRestore();
  });

  it("parks the loop while unfocused and resumes on focus", () => {
    const { canvas, ctx } = makeMockCanvas();
    const ref = { current: canvas };
    const rafCbs: Array<(now: number) => void> = [];
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCbs.push(cb);
      return rafCbs.length;
    });

    const stop = startParticles(ref, "embers");

    rafCbs[rafCbs.length - 1]?.(performance.now());
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    vi.mocked(document.hasFocus).mockReturnValue(false);
    window.dispatchEvent(new Event("blur"));
    const parkedCount = rafCbs.length;
    rafCbs[parkedCount - 1]?.(performance.now());
    expect(rafCbs.length).toBe(parkedCount);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    vi.mocked(document.hasFocus).mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    rafCbs[rafCbs.length - 1]?.(performance.now());
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);

    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const scheduled = rafCbs.length;
    stop();
    stop();
    expect(cancel).toHaveBeenCalledExactlyOnceWith(scheduled);
    expect(disconnectObserver).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event("focus"));
    resizeObserverCallback?.([], {} as ResizeObserver);
    rafCbs[scheduled - 1]?.(performance.now());
    expect(rafCbs).toHaveLength(scheduled);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);

    rafSpy.mockRestore();
  });

  it("renders the requested count, custom color and alpha without leaking the next frame", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.spyOn(performance, "now").mockReturnValue(0);
    const { canvas, ctx } = makeMockCanvas(undefined, { width: 200, height: 100 });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((frame) => frames.push(frame));
    const stop = startParticles({ current: canvas }, "embers", ["rgba(255, 0, 0, X)"], 0.5, 7);
    frames[0]!(16.67);
    expect(ctx.fillStyle).toBe("rgba(255, 0, 0, 1)");
    expect(ctx.globalAlpha).toBe(0.095);
    expect(ctx.arc).toHaveBeenCalledTimes(7);
    expect(ctx.fill).toHaveBeenCalledTimes(7);
    stop();
    frames[1]!(33.34);
    expect(ctx.fill).toHaveBeenCalledTimes(7);
  });
});
