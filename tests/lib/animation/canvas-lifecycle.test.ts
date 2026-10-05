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

  it("skips repeated resize setup while observer-free frames continue, but responds to size and DPR changes", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("devicePixelRatio", 1);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const onResize = vi.fn();
    const onFrame = vi.fn();
    const lifecycle = createCanvasLifecycle({ canvas, onResize, onFrame });
    const writeWidth = vi.spyOn(canvas, "width", "set");
    const writeHeight = vi.spyOn(canvas, "height", "set");
    frames.shift()!(100);
    frames.shift()!(200);
    window.dispatchEvent(new Event("focus"));
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onResize).toHaveBeenCalledExactlyOnceWith(640, 480, 1);
    expect(writeWidth).not.toHaveBeenCalled();
    expect(writeHeight).not.toHaveBeenCalled();

    Object.defineProperty(parent, "clientWidth", { value: 800, configurable: true });
    frames.shift()!(300);
    expect(onResize).toHaveBeenLastCalledWith(800, 480, 1);
    expect(onFrame).toHaveBeenLastCalledWith(300, expect.any(Number), 800, 480);
    expect(canvas.width).toBe(800);

    vi.stubGlobal("devicePixelRatio", 2);
    frames.shift()!(400);
    expect(onResize).toHaveBeenLastCalledWith(800, 480, 2);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(960);

    // Canvas writes reset drawing state even when the requested size is unchanged.
    canvas.width = 2;
    frames.shift()!(500);
    expect(canvas.width).toBe(1600);
    expect(onResize).toHaveBeenCalledTimes(4);
    lifecycle.dispose();
  });

  it.each(["motion", "visibility"])("stops queued frames and resumes after %s changes", (source) => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const onFrame = vi.fn();
    const lifecycle = createCanvasLifecycle({ canvas, onFrame });
    const setPaused = (paused: boolean) => {
      if (source === "motion") localStorage.setItem("alchemy-disable-animations", String(paused));
      else Object.defineProperty(document, "hidden", { value: paused, configurable: true });
    };
    setPaused(true);
    frames.shift()!(100);
    expect(onFrame).not.toHaveBeenCalled();
    expect(frames).toEqual([]);
    setPaused(false);
    const notification = () =>
      source === "motion"
        ? window.dispatchEvent(new Event("storage"))
        : document.dispatchEvent(new Event("visibilitychange"));
    notification();
    frames.shift()!(200);
    expect(onFrame).toHaveBeenCalledExactlyOnceWith(200, expect.any(Number), 640, 480);
    lifecycle.dispose();
    const callsAfterDispose = raf.mock.calls.length;
    notification();
    expect(raf).toHaveBeenCalledTimes(callsAfterDispose);
  });

  it("resumes after the OS reduced-motion preference is switched off", () => {
    const query = new EventTarget();
    let reduced = false;
    Object.defineProperty(query, "matches", { get: () => reduced });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => query as MediaQueryList),
    );
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const onFrame = vi.fn();
    const lifecycle = createCanvasLifecycle({ canvas, onFrame });
    reduced = true;
    frames.shift()!(100);
    expect(onFrame).not.toHaveBeenCalled();
    const callsBeforeResume = raf.mock.calls.length;
    reduced = false;
    query.dispatchEvent(new Event("change"));
    expect(raf).toHaveBeenCalledTimes(callsBeforeResume + 1);
    frames.shift()!(200);
    expect(onFrame).toHaveBeenCalledOnce();
    lifecycle.dispose();
    const callsAfterDispose = raf.mock.calls.length;
    query.dispatchEvent(new Event("change"));
    expect(raf).toHaveBeenCalledTimes(callsAfterDispose);
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
