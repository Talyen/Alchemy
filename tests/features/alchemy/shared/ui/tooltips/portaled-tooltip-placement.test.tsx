import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as floatingUi from "@floating-ui/dom";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  floatingPlacementToTooltipState,
  horizontalInsetForStage,
  preferredFloatingPlacement,
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
    cleanup();
    vi.restoreAllMocks();
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
    render(<Harness placement="above" />);
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

  it("resolves a pixel position through the Floating UI chain", async () => {
    render(<Harness placement="above" />);

    const floating = await screen.findByTestId("tip-floating");
    await waitFor(() => expect(floating.style.left).toMatch(/^-?\d+(\.\d+)?px$/));
    expect(floating.style.top).toMatch(/^-?\d+(\.\d+)?px$/);
  });

  it.each([["side-start"], ["side-end"]] as Array<[PortaledTooltipPlacement]>)(
    "resolves a pixel position for %s",
    async (placement) => {
      render(<Harness placement={placement} />);

      const floating = await screen.findByTestId("tip-floating");
      await waitFor(() => expect(floating.style.left).toMatch(/^-?\d+(\.\d+)?px$/));
      expect(floating.style.top).toMatch(/^-?\d+(\.\d+)?px$/);
    },
  );

  it("does not update state after unmount while position resolves", async () => {
    const { unmount } = render(<Harness placement="above" />);
    unmount();
    await Promise.resolve();
    expect(screen.queryByTestId("tip-floating")).toBeNull();
  });
});

describe("horizontalInsetForStage", () => {
  it("clamps narrow stages to 48 and wide stages to 152", () => {
    expect(horizontalInsetForStage({ left: 0, right: 100 })).toBe(48);
    expect(horizontalInsetForStage({ left: 0, right: 400 })).toBe(100);
    expect(horizontalInsetForStage({ left: 0, right: 2000 })).toBe(152);
  });
});
