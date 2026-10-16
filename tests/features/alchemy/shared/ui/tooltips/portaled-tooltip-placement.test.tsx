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
}: {
  placement: PortaledTooltipPlacement;
  allowFlip?: boolean;
  horizontalInset?: number;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const { tooltipRef, placeBelow, tooltipSide, tooltipStyle } = usePortaledTooltipPlacement(
    triggerRef,
    true,
    8,
    placement,
    undefined,
    allowFlip,
    horizontalInset,
  );
  return (
    <>
      <div ref={triggerRef} data-testid="tip-trigger" />
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

  it("coalesces repeated resize notifications into one frame and disposes it on unmount", () => {
    let remeasure!: () => void;
    vi.spyOn(floatingUi, "autoUpdate").mockImplementation((_trigger, _tooltip, update) => {
      remeasure = update;
      return () => {};
    });
    const compute = vi.spyOn(floatingUi, "computePosition").mockResolvedValue({
      x: 0,
      y: 0,
      placement: "top",
      strategy: "fixed",
      middlewareData: {},
    });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(<Harness placement="above" />);
    act(() => {
      remeasure();
      remeasure();
      remeasure();
    });
    expect(frames).toHaveLength(1);
    expect(cancel).not.toHaveBeenCalled();
    act(() => frames[0]!(0));
    expect(compute).toHaveBeenCalledTimes(2);
    act(() => remeasure());
    unmount();
    expect(cancel).toHaveBeenCalledExactlyOnceWith(2);
  });
});
