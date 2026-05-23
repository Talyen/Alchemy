// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startBackgroundParticles } from "@/lib/animation/background-particles";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal("devicePixelRatio", 1);
});

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

function makeMockCanvas(mockCtx?: Partial<CanvasRenderingContext2D>) {
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
    clientWidth: 1920,
    clientHeight: 1080,
  };
  Object.defineProperty(canvas, "parentElement", { value: parent });
  return { canvas, ctx, parent } as unknown as {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    parent: HTMLElement;
  };
}

describe("startBackgroundParticles", () => {
  it("returns noop cleanup when canvas is null", () => {
    const ref = { current: null };
    const cleanup = startBackgroundParticles(ref as never, "embers");
    expect(cleanup).toBeInstanceOf(Function);
    expect(() => cleanup()).not.toThrow();
  });

  it("returns noop cleanup when canvas has no context", () => {
    const { canvas } = makeMockCanvas();
    vi.mocked(canvas.getContext).mockReturnValue(null);
    const ref = { current: canvas };
    const cleanup = startBackgroundParticles(ref as never, "embers");
    expect(() => cleanup()).not.toThrow();
  });

  it("creates particles and runs animation loop for embers variant", () => {
    const { canvas, ctx } = makeMockCanvas();
    const ref = { current: canvas };
    let calls = 0;
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      calls++;
      if (calls <= 1) cb(performance.now());
      return 1;
    });

    startBackgroundParticles(ref as never, "embers");

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);

    rafSpy.mockRestore();
  });

  it("creates particles for dust variant", () => {
    const { canvas } = makeMockCanvas();
    const ref = { current: canvas };
    let calls = 0;
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      calls++;
      if (calls <= 1) cb(performance.now());
      return 1;
    });

    expect(() => startBackgroundParticles(ref as never, "dust")).not.toThrow();

    rafSpy.mockRestore();
  });

  it("stops animation on cleanup", () => {
    const { canvas } = makeMockCanvas();
    const ref = { current: canvas };
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(99);

    const cleanup = startBackgroundParticles(ref as never, "embers");
    expect(() => cleanup()).not.toThrow();

    rafSpy.mockRestore();
  });

  it("works with custom colors", () => {
    const { canvas } = makeMockCanvas();
    const ref = { current: canvas };
    let calls = 0;
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      calls++;
      if (calls <= 1) cb(performance.now());
      return 1;
    });

    const customColors = ["rgba(255, 0, 0, X)"] as const;
    expect(() =>
      startBackgroundParticles(ref as never, "embers", customColors),
    ).not.toThrow();

    rafSpy.mockRestore();
  });

  it("works with alpha multiplier", () => {
    const { canvas } = makeMockCanvas();
    const ref = { current: canvas };
    let calls = 0;
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      calls++;
      if (calls <= 1) cb(performance.now());
      return 1;
    });

    expect(() =>
      startBackgroundParticles(ref as never, "embers", undefined, 0.5),
    ).not.toThrow();

    rafSpy.mockRestore();
  });
});
