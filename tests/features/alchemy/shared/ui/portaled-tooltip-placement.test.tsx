import { render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  floatingPlacementToTooltipState,
  preferredFloatingPlacement,
  usePortaledTooltipPlacement,
  type PortaledTooltipPlacement,
} from "@/features/alchemy/shared/ui/portaled-tooltip-placement";

describe("preferredFloatingPlacement", () => {
  it("maps above to top", () => {
    expect(preferredFloatingPlacement("above")).toBe("top");
  });

  it("maps side-start to left and side-end to right", () => {
    expect(preferredFloatingPlacement("side-start")).toBe("left");
    expect(preferredFloatingPlacement("side-end")).toBe("right");
  });
});

describe("floatingPlacementToTooltipState", () => {
  it("maps top to above", () => {
    expect(floatingPlacementToTooltipState("top")).toEqual({ placeBelow: false, tooltipSide: null });
  });

  it("maps bottom to below", () => {
    expect(floatingPlacementToTooltipState("bottom")).toEqual({ placeBelow: true, tooltipSide: null });
  });

  it("maps left and right to sides", () => {
    expect(floatingPlacementToTooltipState("left")).toEqual({ placeBelow: false, tooltipSide: "side-start" });
    expect(floatingPlacementToTooltipState("right")).toEqual({ placeBelow: false, tooltipSide: "side-end" });
  });
});

function Harness({ placement }: { placement: PortaledTooltipPlacement }) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const { tooltipRef, placeBelow, tooltipSide, tooltipStyle } = usePortaledTooltipPlacement(
    triggerRef,
    true,
    8,
    placement,
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
    vi.restoreAllMocks();
  });

  it("resolves a pixel position through the Floating UI chain", async () => {
    render(<Harness placement="above" />);

    const floating = await screen.findByTestId("tip-floating");
    await waitFor(() => expect(floating.style.left).toMatch(/^-?\d+(\.\d+)?px$/));
    expect(floating.style.top).toMatch(/^-?\d+(\.\d+)?px$/);
  });
});
