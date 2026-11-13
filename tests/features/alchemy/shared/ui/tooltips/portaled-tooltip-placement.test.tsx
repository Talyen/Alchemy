import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as floatingUi from "@floating-ui/dom";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  usePortaledTooltipPlacement,
  type PortaledTooltipPlacement,
} from "@/features/alchemy/shared/ui/tooltips/portaled-tooltip-placement";

vi.mock("@floating-ui/dom", async (importOriginal) => {
  const original = await importOriginal<typeof floatingUi>();
  return {
    ...original,
    computePosition: (...args: Parameters<typeof original.computePosition>) => original.computePosition(...args),
    autoUpdate: (...args: Parameters<typeof original.autoUpdate>) => original.autoUpdate(...args),
  };
});

function Harness({
  placement,
  allowFlip = true,
  horizontalInset,
  preservePlacementOnResize = false,
  active = true,
  visible = active,
  targetKey = "original",
}: {
  placement: PortaledTooltipPlacement;
  allowFlip?: boolean;
  horizontalInset?: number;
  preservePlacementOnResize?: boolean;
  active?: boolean;
  visible?: boolean;
  targetKey?: string;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const { tooltipRef, placeBelow, tooltipSide, tooltipStyle } = usePortaledTooltipPlacement(
    triggerRef,
    active,
    8,
    placement,
    undefined,
    allowFlip,
    horizontalInset,
    preservePlacementOnResize,
    visible,
  );
  return (
    <>
      <div key={targetKey} ref={triggerRef} data-testid="tip-trigger" data-target={targetKey} />
      <div
        ref={tooltipRef}
        data-testid="tip-floating"
        data-place-below={placeBelow}
        data-side={tooltipSide ?? "none"}
        style={tooltipStyle}
      />
    </>
  );
}

describe("usePortaledTooltipPlacement", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([true, false])("retains a fitting resolved side only when opted in (%s)", async (preserve) => {
    let height = 180;
    let viewportHeight = 1080;
    let remeasure!: () => void;
    const { computePosition } = await vi.importActual<typeof floatingUi>("@floating-ui/dom");
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation((_trigger, _tooltip, update) => {
      remeasure = update;
      return () => {};
    });
    vi.spyOn(floatingUi, "computePosition").mockImplementation((reference, floating, options) =>
      computePosition(reference, floating, {
        ...options,
        platform: {
          ...floatingUi.platform,
          getElementRects: async () => ({
            reference: { x: 900, y: 230, width: 200, height: 300 },
            floating: { x: 0, y: 0, width: 320, height },
          }),
          getClippingRect: async () => ({ x: 0, y: 0, width: 1920, height: viewportHeight }),
          getOffsetParent: async () => window,
          isElement: async () => false,
          convertOffsetParentRelativeRectToViewportRelativeRect: async ({ rect }) => rect,
        },
      }),
    );
    vi.spyOn(document.documentElement, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(0, 0, 1920, viewportHeight),
    );
    const view = render(<Harness placement="above" preservePlacementOnResize={preserve} />);
    const floating = screen.getByTestId("tip-floating");
    await waitFor(() => expect(floating.style.top).toBe("42px"));
    height = 274;
    act(() => remeasure());
    await waitFor(() => expect(floating.dataset.placeBelow).toBe("true"));
    expect(floating.style.top).toBe("538px");
    height = 198;
    act(() => remeasure());
    await waitFor(() => expect(floating.style.top).toBe(preserve ? "538px" : "24px"));
    // A retained side must still yield when the viewport no longer has room.
    viewportHeight = 640;
    act(() => remeasure());
    await waitFor(() => expect(floating.style.top).toBe("24px"));
    viewportHeight = 1080;
    act(() => remeasure());
    await waitFor(() => expect(floating.style.top).toBe("24px"));
    view.rerender(<Harness placement="above" preservePlacementOnResize={preserve} active={false} />);
    expect(floating.style.top).toBe("");
    height = 180;
    view.rerender(<Harness placement="above" preservePlacementOnResize={preserve} />);
    await waitFor(() => expect(floating.style.top).toBe("42px"));
  });

  it("anchors a crafting hover through growth/removal, clamps to the viewport, and resets on re-entry or a new target", async () => {
    let width = 372;
    let viewportWidth = 1920;
    let resized!: ResizeObserverCallback;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resized = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation(() => () => {});
    vi.spyOn(document.documentElement, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(0, 0, viewportWidth, 1080),
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === "tip-trigger")
        return new DOMRect(this.dataset.target === "original" ? 900 : 500, 230, 200, 300);
      return new DOMRect(
        0,
        0,
        Math.min(
          Number.parseFloat(this.style.maxWidth) || Infinity,
          Math.max(width, Number.parseFloat(this.style.minWidth) || 0),
        ),
        180,
      );
    });
    vi.spyOn(floatingUi, "computePosition").mockImplementation(async (trigger, floating) => ({
      x:
        trigger.getBoundingClientRect().left +
        trigger.getBoundingClientRect().width / 2 -
        floating.getBoundingClientRect().width / 2,
      y: 538,
      placement: "bottom",
      strategy: "fixed",
      middlewareData: {},
    }));
    const view = render(<Harness placement="below" preservePlacementOnResize />);
    const floating = screen.getByTestId("tip-floating");
    const resize = () =>
      act(() => resized([{ target: floating } as unknown as ResizeObserverEntry], {} as ResizeObserver));
    await waitFor(() => expect(floating.style.minWidth).toBe("372px"));
    const left = floating.style.left;
    width = 298;
    resize();
    await waitFor(() => expect(floating.style.left).toBe(left));
    expect(floating.style.minWidth).toBe("372px");
    width = 410;
    resize();
    await waitFor(() => expect(floating.style.minWidth).toBe("410px"));
    expect(floating.style.left).toBe(left);
    width = 310;
    resize();
    await waitFor(() => expect(floating.style.left).toBe(left));
    expect(floating.style.minWidth).toBe("410px");
    view.rerender(<Harness placement="below" preservePlacementOnResize visible={false} />);
    expect(floating.style.minWidth).toBe("410px");
    width = 250;
    view.rerender(<Harness placement="below" preservePlacementOnResize />);
    await waitFor(() => expect(floating.style.minWidth).toBe("250px"));
    expect(floating.style.left).toBe("875px");
    viewportWidth = 600;
    width = 410;
    resize();
    await waitFor(() => expect(floating.style.minWidth).toBe("300px"));
    expect(floating.style.left).toBe("150px");
    expect(Number.parseFloat(floating.style.left) + floating.getBoundingClientRect().width).toBe(450);
    viewportWidth = 1920;
    resize();
    await waitFor(() => expect(floating.style.left).toBe("875px"));
    width = 200;
    view.rerender(<Harness placement="below" preservePlacementOnResize targetKey="different-item" />);
    await waitFor(() => expect(floating.style.minWidth).toBe("200px"));
    expect(floating.style.left).toBe("500px");
    view.rerender(<Harness placement="below" preservePlacementOnResize active={false} />);
    expect(floating.style.minWidth).toBe("");
  });

  it.each([
    { triggerY: 16, height: 40, expectedTop: 64 },
    { triggerY: 1040, height: 80, expectedTop: 992 },
  ])("keeps fixed below tooltips within the viewport at y=$triggerY", async ({ triggerY, height, expectedTop }) => {
    const center = 1836;
    const { computePosition } = await vi.importActual<typeof floatingUi>("@floating-ui/dom");
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation(() => () => {});
    vi.spyOn(floatingUi, "computePosition").mockImplementation((reference, floating, options) =>
      computePosition(reference, floating, {
        ...options,
        platform: {
          ...floatingUi.platform,
          getElementRects: async () => ({
            reference: { x: center - 20, y: triggerY, width: 40, height: 40 },
            floating: { x: 0, y: 0, width: 140, height },
          }),
          getClippingRect: async () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
          getOffsetParent: async () => window,
          isElement: async () => false,
          convertOffsetParentRelativeRectToViewportRelativeRect: async ({ rect }) => rect,
        },
      }),
    );
    vi.spyOn(document.documentElement, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1920, 1080));

    render(<Harness placement="below" allowFlip={false} horizontalInset={8} />);

    const floating = screen.getByTestId("tip-floating");
    await waitFor(() => expect(floating.style.left).toBe(`${center - 70}px`));
    expect(floating.style.top).toBe(`${expectedTop}px`);
    expect(floating.dataset.placeBelow).toBe("true");
    expect(floating.dataset.side).toBe("none");
  });

  it.each([
    { center: 170, firstLeft: 152, grownLeft: 152 },
    { center: 1100, firstLeft: 928, grownLeft: 728 },
  ])("keeps a growing reserved tooltip on screen near x=$center", async ({ center, firstLeft, grownLeft }) => {
    let width = 200;
    let remeasure!: () => void;
    const { computePosition } = await vi.importActual<typeof floatingUi>("@floating-ui/dom");
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation((_trigger, _tooltip, update) => {
      remeasure = update;
      return () => {};
    });
    vi.spyOn(document.documentElement, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1280, 1080));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === "tip-trigger"
        ? new DOMRect(center - 20, 200, 40, 40)
        : new DOMRect(0, 0, width, 100);
    });
    vi.spyOn(floatingUi, "computePosition").mockImplementation((reference, floating, options) =>
      computePosition(reference, floating, {
        ...options,
        platform: {
          ...floatingUi.platform,
          getElementRects: async () => ({
            reference: { x: center - 20, y: 200, width: 40, height: 40 },
            floating: { x: 0, y: 0, width, height: 100 },
          }),
          getClippingRect: async () => ({ x: 0, y: 0, width: 1280, height: 1080 }),
          getOffsetParent: async () => window,
          isElement: async () => false,
          convertOffsetParentRelativeRectToViewportRelativeRect: async ({ rect }) => rect,
        },
      }),
    );
    render(<Harness placement="below" preservePlacementOnResize />);
    const floating = screen.getByTestId("tip-floating");
    await waitFor(() => expect(floating.style.left).toBe(`${firstLeft}px`));
    width = 400;
    act(() => remeasure());
    await waitFor(() => expect(floating.style.left).toBe(`${grownLeft}px`));
    expect(Number.parseFloat(floating.style.left)).toBeGreaterThanOrEqual(152);
    expect(Number.parseFloat(floating.style.left) + width).toBeLessThanOrEqual(1280 - 152);
  });

  it("keeps a wide side placement inside the stage when neither side has room", async () => {
    const { computePosition } = await vi.importActual<typeof floatingUi>("@floating-ui/dom");
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation(() => () => {});
    vi.spyOn(floatingUi, "computePosition").mockImplementation((reference, floating, options) =>
      computePosition(reference, floating, {
        ...options,
        platform: {
          ...floatingUi.platform,
          getElementRects: async () => ({
            reference: { x: 500, y: 50, width: 140, height: 100 },
            floating: { x: 0, y: 0, width: 976, height: 420 },
          }),
          getClippingRect: async () => ({ x: 0, y: 0, width: 1280, height: 480 }),
          getOffsetParent: async () => window,
          isElement: async () => false,
          convertOffsetParentRelativeRectToViewportRelativeRect: async ({ rect }) => rect,
        },
      }),
    );
    vi.spyOn(document.documentElement, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1280, 480));

    render(<Harness placement="side-end" />);
    const floating = screen.getByTestId("tip-floating");
    await waitFor(() => expect(floating.style.left).not.toBe(""));
    const left = Number.parseFloat(floating.style.left);
    expect(left).toBeGreaterThanOrEqual(152);
    expect(left + 976).toBeLessThanOrEqual(1280 - 152);
  });

  it("keeps the newest position when an older measurement finishes after a resize", async () => {
    const pending: Array<(result: Awaited<ReturnType<typeof floatingUi.computePosition>>) => void> = [];
    const compute = vi.spyOn(floatingUi, "computePosition").mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );
    let remeasure!: () => void;
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation((_reference, _floating, update) => {
      remeasure = update;
      return () => {};
    });
    render(<Harness placement="below" />);
    expect(compute).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ placement: "bottom" }),
    );
    act(() => remeasure());
    await waitFor(() => expect(compute).toHaveBeenCalledTimes(2));
    const result = { x: 200, y: 100, placement: "bottom" as const, strategy: "fixed" as const, middlewareData: {} };
    await act(async () => pending[1]!(result));
    const floating = screen.getByTestId("tip-floating");
    expect(floating.style.left).toBe("200px");
    await act(async () => pending[0]!({ ...result, x: 10, y: 20, placement: "top" }));
    expect(floating.style.left).toBe("200px");
    expect(floating.style.top).toBe("100px");
    expect(floating.dataset.placeBelow).toBe("true");
  });

  it("cancels scheduled measurement on a placement change and ignores the old result", async () => {
    const pending: Array<(result: Awaited<ReturnType<typeof floatingUi.computePosition>>) => void> = [];
    vi.spyOn(floatingUi, "computePosition").mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );
    let remeasure!: () => void;
    const stop = vi.fn();
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation((_trigger, _tooltip, update) => {
      remeasure = update;
      return stop;
    });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(123);
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const { rerender, unmount } = render(<Harness placement="above" />);
    act(() => remeasure());
    rerender(<Harness placement="side-end" />);
    expect(cancel).toHaveBeenCalledWith(123);
    expect(stop).toHaveBeenCalledTimes(1);
    const result = { x: 50, y: 60, placement: "right" as const, strategy: "fixed" as const, middlewareData: {} };
    await act(async () => pending[1]!(result));
    await act(async () => pending[0]!({ ...result, x: 1, y: 2, placement: "bottom" }));
    const floating = screen.getByTestId("tip-floating");
    expect(floating.style.left).toBe("50px");
    expect(floating.dataset.side).toBe("side-end");
    expect(floating.dataset.placeBelow).toBe("false");
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("does not revive an interrupted hover or carry its pending anchor into reopening", async () => {
    const pending: Array<(result: Awaited<ReturnType<typeof floatingUi.computePosition>>) => void> = [];
    vi.spyOn(document.documentElement, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1920, 1080));
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation(() => () => {});
    vi.spyOn(floatingUi, "computePosition").mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );
    const view = render(<Harness placement="below" preservePlacementOnResize />);
    expect(pending).toHaveLength(1);
    view.rerender(<Harness placement="below" preservePlacementOnResize active={false} />);
    const floating = screen.getByTestId("tip-floating");
    expect(floating.style.left).toBe("");
    view.rerender(<Harness placement="below" preservePlacementOnResize />);
    expect(pending).toHaveLength(2);
    const result = { x: 600, y: 100, placement: "bottom" as const, strategy: "fixed" as const, middlewareData: {} };
    await act(async () => pending[1]!(result));
    expect(floating.style.left).toBe("600px");
    await act(async () => pending[0]!({ ...result, x: 200 }));
    expect(floating.style.left).toBe("600px");
    view.rerender(<Harness placement="below" preservePlacementOnResize visible={false} />);
    view.rerender(<Harness placement="below" preservePlacementOnResize />);
    expect(pending).toHaveLength(4);
    await act(async () => pending[3]!({ ...result, x: 800 }));
    await act(async () => pending[2]!({ ...result, x: 300 }));
    expect(floating.style.left).toBe("800px");
  });

  it("absorbs a rejected measurement without an unhandled rejection and positions on the next pass", async () => {
    const compute = vi.spyOn(floatingUi, "computePosition").mockRejectedValueOnce(new Error("unmounted mid-flight"));
    let remeasure!: () => void;
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation((_reference, _floating, update) => {
      remeasure = update;
      return () => {};
    });
    const rejections: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      rejections.push(event.reason);
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    try {
      render(<Harness placement="below" />);
      await waitFor(() => expect(compute).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(rejections).toEqual([]);
      compute.mockResolvedValue({ x: 30, y: 40, placement: "bottom", strategy: "fixed", middlewareData: {} });
      act(() => remeasure());
      await waitFor(() => expect(screen.getByTestId("tip-floating").style.left).toBe("30px"));
    } finally {
      window.removeEventListener("unhandledrejection", onUnhandled);
    }
  });

  it("coalesces movement and content resizes, resizes the panel, and cancels pending work on unmount", async () => {
    let remeasure!: () => void;
    const stop = vi.fn();
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation((_trigger, _tooltip, update) => {
      remeasure = update;
      return stop;
    });
    let resize!: ResizeObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    let height = 700;
    vi.spyOn(document.documentElement, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1000, 600));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, 0, 200, height));
    const compute = vi.spyOn(floatingUi, "computePosition").mockResolvedValue({
      x: 20,
      y: 30,
      placement: "top",
      strategy: "fixed",
      middlewareData: {},
    });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<Harness placement="above" />);
    });
    const tooltip = screen.getByTestId("tip-floating");
    expect(Number.parseFloat(tooltip.style.width)).toBeGreaterThan(0);
    expect(tooltip.style.left).toBe("20px");
    compute.mockResolvedValue({ x: 40, y: 60, placement: "top", strategy: "fixed", middlewareData: {} });
    height = 200;
    act(() => {
      remeasure();
      remeasure();
      resize([{ target: tooltip } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    });
    expect(frames).toHaveLength(1);
    expect(cancel).not.toHaveBeenCalled();
    await act(async () => frames[0]!(0));
    expect(compute).toHaveBeenCalledTimes(2);
    expect(tooltip.style.width).toBe("");
    expect(tooltip.style.left).toBe("40px");
    expect(tooltip.style.top).toBe("60px");
    act(() => remeasure());
    view.unmount();
    expect(cancel).toHaveBeenCalledExactlyOnceWith(2);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });
});
