// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getVirtualResolutionLayout,
  resolveAutoAspectRatio,
  useVirtualResolution,
} from "@/features/alchemy/shared/hooks";

describe("resolveAutoAspectRatio", () => {
  it.each([
    [1920, 1080, "16:9"],
    [1920, 1200, "16:10"],
    [1280, 800, "16:10"],
    [2560, 1080, "21:9"],
    [3440, 1440, "21:9"],
    [2560, 1600, "16:10"],
    [3840, 2160, "16:9"],
    [1366, 768, "16:9"],
    [1600, 900, "16:9"],
  ] as const)("resolves %ix%i to %s", (width, height, expected) => {
    expect(resolveAutoAspectRatio(width, height)).toBe(expected);
  });
});

describe("getVirtualResolutionLayout", () => {
  it("keeps native 16:9 windows at scale 1", () => {
    const layout = getVirtualResolutionLayout("16:9", 1920, 1080);
    const transformScale = Number(layout.stageStyle.transform.match(/^scale\(([^)]+)\)$/)?.[1]);

    expect(transformScale).toBe(1);
    expect(parseFloat(layout.frameStyle.width)).toBe(1920);
    expect(parseFloat(layout.frameStyle.height)).toBe(1080);
    expect(layout.stagePixelRatio).toBe(1);
  });

  it("uses one proportional logical stage at 4K", () => {
    const layout = getVirtualResolutionLayout("16:9", 3840, 2160);
    const transformScale = Number(layout.stageStyle.transform.match(/^scale\(([^)]+)\)$/)?.[1]);

    expect(layout.stagePixelRatio).toBe(1);
    expect(layout.stageStyle.width).toBe("1920px");
    expect(layout.stageStyle.height).toBe("1080px");
    expect(transformScale).toBe(2);
    expect(parseFloat(layout.frameStyle.width)).toBe(3840);
    expect(parseFloat(layout.frameStyle.height)).toBe(2160);
  });

  it("preserves fixed-rem proportions between standard and native rendering", () => {
    const standard = getVirtualResolutionLayout("16:9", 1920, 1080);
    const ultraHd = getVirtualResolutionLayout("16:9", 3840, 2160);

    function fixedRemToFrameHeight(layout: ReturnType<typeof getVirtualResolutionLayout>) {
      const transformScale = Number(layout.stageStyle.transform.match(/^scale\(([^)]+)\)$/)?.[1]);
      const visualRem = 16 * transformScale;
      return visualRem / parseFloat(layout.frameStyle.height);
    }

    expect(fixedRemToFrameHeight(ultraHd)).toBeCloseTo(fixedRemToFrameHeight(standard), 8);
  });

  it("selects and fits a MacBook-shaped 16:10 stage", () => {
    const layout = getVirtualResolutionLayout("auto", 1512, 982);
    const transformScale = Number(layout.stageStyle.transform.match(/^scale\(([^)]+)\)$/)?.[1]);

    expect(layout.aspectMode).toBe("narrow");
    expect(parseFloat(layout.frameStyle.width)).toBe(1512);
    expect(parseFloat(layout.frameStyle.height)).toBeLessThanOrEqual(982);
    expect(transformScale).toBeLessThan(1);
  });
});

describe("useVirtualResolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setViewport(width: number, height: number) {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  }

  it("coalesces resize bursts to the latest dimensions once per animation frame", () => {
    setViewport(1920, 1080);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useVirtualResolution("16:9");
    });

    setViewport(1600, 900);
    window.dispatchEvent(new Event("resize"));
    setViewport(1280, 720);
    window.dispatchEvent(new Event("resize"));

    expect(frames).toHaveLength(1);
    expect(renders).toBe(1);

    act(() => frames[0]!(performance.now()));

    expect(renders).toBe(2);
    expect(result.current.frameStyle.width).toBe("1280px");
    expect(result.current.frameStyle.height).toBe("720px");
  });

  it("skips renders for resize events whose dimensions did not change", () => {
    setViewport(1920, 1080);
    let frame: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useVirtualResolution("16:9");
    });

    window.dispatchEvent(new Event("resize"));
    act(() => frame?.(performance.now()));

    expect(renders).toBe(1);
  });

  it("cancels a pending resize frame on unmount and does not subscribe in bypass mode", () => {
    setViewport(1920, 1080);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 17),
    );
    const cancelFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    const addListener = vi.spyOn(window, "addEventListener");
    const { unmount } = renderHook(() => useVirtualResolution("16:9"));

    window.dispatchEvent(new Event("resize"));
    unmount();

    expect(cancelFrame).toHaveBeenCalledWith(17);
    addListener.mockClear();
    renderHook(() => useVirtualResolution("16:9", true));
    expect(addListener).not.toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
