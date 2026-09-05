import { act, cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { usePortaledTooltipPlacement } from "@/features/alchemy/shared/ui/portaled-tooltip-placement";

const floating = vi.hoisted(() => ({ update: () => {}, computePosition: vi.fn() }));
vi.mock("@floating-ui/dom", () => ({
  autoUpdate: (_trigger: Element, _tooltip: Element, update: () => void) => {
    floating.update = update;
    return () => {};
  },
  computePosition: floating.computePosition,
  offset: () => ({}),
  flip: () => ({}),
  shift: () => ({}),
}));

function resizeEntry(target: Element): ResizeObserverEntry {
  return {
    target,
    contentRect: target.getBoundingClientRect(),
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  };
}

function Harness() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const { tooltipRef, tooltipStyle } = usePortaledTooltipPlacement(triggerRef, true);
  return (
    <>
      <div ref={triggerRef} data-testid="trigger" />
      <div ref={tooltipRef} style={tooltipStyle} data-testid="tooltip" />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("repositions without resizing and recalculates width when the tooltip or stage changes size", async () => {
  let resize: ResizeObserverCallback = () => {};
  let frame: FrameRequestCallback = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  floating.computePosition.mockResolvedValue({ x: 20, y: 30, placement: "top" });
  const styleReads = vi.spyOn(window, "getComputedStyle");
  await act(async () => {
    render(<Harness />);
  });
  const tooltip = screen.getByTestId("tooltip");
  const trigger = screen.getByTestId("trigger");
  const sizingReads = () => styleReads.mock.calls.filter(([element]) => element === tooltip).length;
  expect(sizingReads()).toBe(1);
  floating.computePosition.mockResolvedValue({ x: 40, y: 60, placement: "top" });
  await act(async () => {
    floating.update();
    frame(16);
  });
  expect(tooltip.style.left).toBe("40px");
  expect(tooltip.style.top).toBe("60px");
  expect(sizingReads()).toBe(1);
  await act(async () => {
    resize([resizeEntry(trigger)], {} as ResizeObserver);
    frame(32);
  });
  expect(sizingReads()).toBe(1);
  for (const target of [tooltip, document.documentElement]) {
    await act(async () => {
      resize([resizeEntry(target)], {} as ResizeObserver);
      frame(48);
    });
  }
  expect(sizingReads()).toBe(3);
  vi.spyOn(document.documentElement, "getBoundingClientRect").mockReturnValue({
    width: 1200,
    height: 700,
    left: 0,
    right: 1200,
  } as DOMRect);
  await act(async () => {
    floating.update();
    frame(64);
  });
  expect(sizingReads()).toBe(4);
});
