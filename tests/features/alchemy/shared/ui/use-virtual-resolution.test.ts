import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVirtualResolution } from "@/features/alchemy/shared/ui/use-virtual-resolution";

// Geometry and preference arithmetic live in display-sizing.test.ts. This
// suite protects the browser subscription and animation-frame lifecycle.
describe("useVirtualResolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
      return useVirtualResolution();
    });

    setViewport(1600, 900);
    window.dispatchEvent(new Event("resize"));
    setViewport(1280, 800);
    window.dispatchEvent(new Event("resize"));

    expect(frames).toHaveLength(1);
    expect(renders).toBe(1);

    act(() => frames[0]!(performance.now()));

    expect(renders).toBe(2);
    expect(result.current.frameStyle.width).toBe("1280px");
    expect(result.current.frameStyle.height).toBe("800px");
    expect(result.current.stageStyle.transform).toBe("scale(0.7407407407407407)");
  });

  it("uses the latest viewport when leaving bypass mode after unsubscribed resizes", () => {
    setViewport(1920, 1080);
    const { result, rerender } = renderHook((bypass) => useVirtualResolution(bypass), { initialProps: true });
    setViewport(1280, 800);
    window.dispatchEvent(new Event("resize"));
    rerender(false);
    expect(result.current.frameStyle.width).toBe("1280px");
    expect(result.current.frameStyle.height).toBe("800px");
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
    const { unmount } = renderHook(() => useVirtualResolution());

    window.dispatchEvent(new Event("resize"));
    unmount();

    expect(cancelFrame).toHaveBeenCalledWith(17);
    addListener.mockClear();
    renderHook(() => useVirtualResolution(true));
    expect(addListener).not.toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
