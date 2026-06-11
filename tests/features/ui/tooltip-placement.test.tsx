// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import {
  measureTooltipPlacement,
  TooltipPanel,
  tooltipSideAnchorClass,
  useTooltipFlip,
  useTooltipSidePlacement,
} from "@/features/alchemy/shared/ui/tooltip-panel";

function Probe({ trigger }: { trigger: unknown }) {
  const { ref, flip } = useTooltipFlip(trigger);
  return <div ref={ref} data-testid="probe" data-flip={flip ? "true" : "false"} />;
}

function SideProbe({ trigger }: { trigger: unknown }) {
  const { ref, placement } = useTooltipSidePlacement("side-end", trigger);
  return <div ref={ref} data-testid="side-probe" data-placement={placement} />;
}

describe("measureTooltipPlacement", () => {
  it("keeps above placement when the tooltip fits in the viewport", () => {
    expect(measureTooltipPlacement({ top: 100, left: 50, right: 250 }, 8, 800)).toEqual({
      flip: false,
      dx: 0,
    });
  });

  it("flips below when clipped above the viewport edge", () => {
    expect(measureTooltipPlacement({ top: 4, left: 50, right: 250 }, 8, 800)).toEqual({
      flip: true,
      dx: 0,
    });
  });

  it("shifts horizontally when clipped on the left", () => {
    expect(measureTooltipPlacement({ top: 100, left: -10, right: 190 }, 8, 800)).toEqual({
      flip: false,
      dx: 18,
    });
  });

  it("shifts horizontally when clipped on the right", () => {
    expect(measureTooltipPlacement({ top: 100, left: 650, right: 850 }, 8, 800)).toEqual({
      flip: false,
      dx: -58,
    });
  });
});

describe("useTooltipFlip", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("resets flip when the trigger changes", () => {
    const rect = { top: 100, left: 50, right: 250, bottom: 200, width: 200, height: 100, x: 50, y: 100, toJSON: () => ({}) };

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect as DOMRect);

    const { rerender } = render(<Probe trigger="knight" />);
    expect(screen.getByTestId("probe").getAttribute("data-flip")).toBe("false");

    rerender(<Probe trigger="rogue" />);
    expect(screen.getByTestId("probe").getAttribute("data-flip")).toBe("false");
  });

  it("flips below after measuring a top-clipped tooltip", async () => {
    const clippedRect = {
      top: 2,
      left: 50,
      right: 250,
      bottom: 120,
      width: 200,
      height: 118,
      x: 50,
      y: 2,
      toJSON: () => ({}),
    };
    const belowRect = {
      top: 220,
      left: 50,
      right: 250,
      bottom: 340,
      width: 200,
      height: 120,
      x: 50,
      y: 220,
      toJSON: () => ({}),
    };

    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValueOnce(clippedRect as DOMRect)
      .mockReturnValue(belowRect as DOMRect);

    render(<Probe trigger="knight" />);

    await waitFor(() => {
      expect(screen.getByTestId("probe").getAttribute("data-flip")).toBe("true");
    });

    expect(spy).toHaveBeenCalled();
  });
});

describe("tooltipSideAnchorClass", () => {
  it("places side-end tooltips to the left of the anchor", () => {
    const className = tooltipSideAnchorClass("side-end");
    expect(className).toContain("right-[calc(100%+1rem)]");
    expect(className).toContain("left-auto");
  });

  it("places side-start tooltips to the right of the anchor", () => {
    const className = tooltipSideAnchorClass("side-start");
    expect(className).toContain("left-[calc(100%+1rem)]");
    expect(className).toContain("right-auto");
  });
});

describe("useTooltipSidePlacement", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("resets placement when the trigger changes", () => {
    const rect = { top: 100, left: 50, right: 250, bottom: 200, width: 200, height: 100, x: 50, y: 100, toJSON: () => ({}) };

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect as DOMRect);

    const { rerender } = render(<SideProbe trigger="show-a" />);
    expect(screen.getByTestId("side-probe").getAttribute("data-placement")).toBe("side-end");

    rerender(<SideProbe trigger="show-b" />);
    expect(screen.getByTestId("side-probe").getAttribute("data-placement")).toBe("side-end");
  });

  it("flips to side-start when side-end is clipped on the left", async () => {
    const clippedRect = {
      top: 100,
      left: 2,
      right: 202,
      bottom: 200,
      width: 200,
      height: 100,
      x: 2,
      y: 100,
      toJSON: () => ({}),
    };
    const flippedRect = {
      top: 100,
      left: 220,
      right: 420,
      bottom: 200,
      width: 200,
      height: 100,
      x: 220,
      y: 100,
      toJSON: () => ({}),
    };

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValueOnce(clippedRect as DOMRect)
      .mockReturnValue(flippedRect as DOMRect);

    render(<SideProbe trigger="show" />);

    await waitFor(() => {
      expect(screen.getByTestId("side-probe").getAttribute("data-placement")).toBe("side-start");
    });
  });
});

describe("TooltipPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("anchors above by default and below when flipped", () => {
    const { rerender } = render(
      <div className="relative">
        <TooltipPanel visible>Body</TooltipPanel>
      </div>,
    );

    const panel = screen.getByText("Body");
    expect(panel.className).toContain("bottom-full");
    expect(panel.getAttribute("data-placement")).toBe("above");

    rerender(
      <div className="relative">
        <TooltipPanel visible flip>
          Body
        </TooltipPanel>
      </div>,
    );

    expect(panel.className).toContain("top-full");
    expect(panel.getAttribute("data-placement")).toBe("below");
  });
});
