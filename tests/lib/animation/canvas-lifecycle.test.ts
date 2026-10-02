import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvasLifecycle, resolveCanvasBackingScale } from "@/lib/animation/canvas-lifecycle";

describe("resolveCanvasBackingScale", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies default scale capped between minScale and maxScale", () => {
    vi.stubGlobal("devicePixelRatio", 1);
    const scale = resolveCanvasBackingScale(800, 600);
    expect(scale).toBe(1);

    vi.stubGlobal("devicePixelRatio", 4);
    const clampedScale = resolveCanvasBackingScale(800, 600, { maxScale: 2 });
    expect(clampedScale).toBe(2);
  });

  it("limits scale when pixel count would exceed maxPixels", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const scale = resolveCanvasBackingScale(3840, 2160, { maxPixels: 1_500_000, scaleMultiplier: 0.5 });
    expect(3840 * 2160 * scale * scale).toBeLessThanOrEqual(1_500_001);
  });
});

describe("createCanvasLifecycle", () => {
  let parent: HTMLElement;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    localStorage.clear();
    parent = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { value: 640, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 480, configurable: true });
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
    document.body.appendChild(parent);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });

  afterEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns noop lifecycle when parent element is null", () => {
    const unattached = document.createElement("canvas");
    const onFrame = vi.fn();
    const lifecycle = createCanvasLifecycle({
      canvas: unattached,
      onFrame,
    });
    expect(lifecycle.logicalWidth).toBe(0);
    expect(lifecycle.logicalHeight).toBe(0);
    lifecycle.scheduleFrame();
    lifecycle.dispose();
    expect(onFrame).not.toHaveBeenCalled();
  });

  it("initializes logical dimensions without clearing an already-sized canvas", () => {
    vi.stubGlobal("devicePixelRatio", 1);
    canvas.width = 640;
    canvas.height = 480;
    const writeWidth = vi.spyOn(canvas, "width", "set");
    const writeHeight = vi.spyOn(canvas, "height", "set");
    const onResize = vi.fn();
    const onFrame = vi.fn();
    const lifecycle = createCanvasLifecycle({
      canvas,
      onResize,
      onFrame,
    });

    expect(canvas.style.width).toBe("640px");
    expect(canvas.style.height).toBe("480px");
    expect(lifecycle.logicalWidth).toBe(640);
    expect(lifecycle.logicalHeight).toBe(480);
    expect(onResize).toHaveBeenCalledWith(640, 480, 1);
    expect(writeWidth).not.toHaveBeenCalled();
    expect(writeHeight).not.toHaveBeenCalled();
    lifecycle.dispose();
  });

  it("runs animation frame callbacks with delta time", () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallback = cb;
      return 42;
    });

    const onFrame = vi.fn();
    const lifecycle = createCanvasLifecycle({
      canvas,
      onFrame,
    });

    expect(frameCallback).not.toBeNull();
    frameCallback!(100);
    expect(onFrame).toHaveBeenCalledWith(100, expect.any(Number), 640, 480);
    lifecycle.dispose();
  });

  it("pauses frame loop when motion is disabled", () => {
    localStorage.setItem("alchemy-disable-animations", "true");
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const onFrame = vi.fn();

    const lifecycle = createCanvasLifecycle({
      canvas,
      onFrame,
    });

    expect(raf).not.toHaveBeenCalled();
    expect(onFrame).not.toHaveBeenCalled();
    lifecycle.dispose();
  });

  it("pauses frame loop when document is hidden", () => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const onFrame = vi.fn();

    const lifecycle = createCanvasLifecycle({
      canvas,
      onFrame,
    });

    expect(raf).not.toHaveBeenCalled();
    lifecycle.dispose();
  });

  it("cleans up listeners and cancels animation frames on dispose", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(99);
    const cancelRaf = vi.spyOn(window, "cancelAnimationFrame");
    const onResize = vi.fn();
    const lifecycle = createCanvasLifecycle({
      canvas,
      onFrame: vi.fn(),
      onResize,
    });

    lifecycle.dispose();
    lifecycle.dispose();
    onResize.mockClear();
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    lifecycle.scheduleFrame();
    expect(onResize).not.toHaveBeenCalled();
    expect(cancelRaf).toHaveBeenCalledExactlyOnceWith(99);
  });
});
