import { describe, it, expect, vi, afterEach } from "vitest";
import { render, renderHook, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { useHoverVisible } from "@/features/alchemy/shared/ui/use-hover-visible";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useHoverVisible", () => {
  it("dismisses for inspection without flashing back on focus restoration", () => {
    function InspectionHover() {
      const [open, setOpen] = useState(false);
      const { triggerRef, onMouseEnter, onMouseLeave, onMouseMove, onFocusCapture, onBlurCapture, dismiss, visible } =
        useHoverVisible<HTMLButtonElement>({ suspended: open });
      return (
        <>
          <button
            ref={triggerRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseMove={onMouseMove}
            onFocusCapture={onFocusCapture}
            onBlurCapture={onBlurCapture}
            onClick={() => {
              dismiss();
              setOpen(true);
            }}
          >
            Inspect
          </button>
          {open ? <button onClick={() => setOpen(false)}>Close</button> : null}
          <span data-testid="visible">{String(visible)}</span>
        </>
      );
    }
    render(<InspectionHover />);
    const trigger = screen.getByRole("button", { name: "Inspect" });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId("visible").textContent).toBe("true");
    fireEvent.click(trigger);
    fireEvent.blur(trigger);
    expect(screen.getByTestId("visible").textContent).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.focus(trigger);
    expect(screen.getByTestId("visible").textContent).toBe("false");
    fireEvent.mouseMove(trigger);
    expect(screen.getByTestId("visible").textContent).toBe("true");
  });

  it("holds through exit and cancels stale expiry when hover returns", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook((isHovered) => useHoverVisible({ holdMs: 160, isHovered }), {
      initialProps: true,
    });
    rerender(false);
    expect(result.current.showPopup).toBe(true);
    act(() => vi.advanceTimersByTime(80));
    rerender(true);
    act(() => vi.advanceTimersByTime(160));
    expect(result.current.showPopup).toBe(true);
    rerender(false);
    act(() => vi.advanceTimersByTime(160));
    expect(result.current.showPopup).toBe(false);
  });

  it("keeps a focused popup open on mouse leave but closes it on blur", () => {
    const { result } = renderHook(() => useHoverVisible({ focusWithinGuard: true }));
    const wrapper = document.createElement("div");
    result.current.wrapperRef.current = wrapper;
    vi.spyOn(wrapper, "matches").mockImplementation((selector) => selector === ":focus-within");
    act(() => result.current.onMouseEnter());
    act(() => result.current.onMouseLeave());
    expect(result.current.visible).toBe(true);
    act(() => result.current.onBlurCapture());
    expect(result.current.visible).toBe(false);
  });

  it("suppresses disabled hover callbacks and hides even a held controlled popup", () => {
    const onHoverStart = vi.fn();
    const onHoverEnd = vi.fn();
    const { result, rerender } = renderHook(
      (interactive) => useHoverVisible({ holdMs: 160, interactive, isHovered: true, onHoverStart, onHoverEnd }),
      { initialProps: false },
    );
    act(() => {
      result.current.onMouseEnter();
      result.current.onMouseLeave();
    });
    expect(result.current.showPopup).toBe(false);
    expect(onHoverStart).not.toHaveBeenCalled();
    expect(onHoverEnd).not.toHaveBeenCalled();
    rerender(true);
    expect(result.current.showPopup).toBe(true);
    act(() => {
      result.current.onMouseEnter();
      result.current.onMouseLeave();
    });
    expect(onHoverStart).toHaveBeenCalledOnce();
    expect(onHoverEnd).toHaveBeenCalledOnce();
    rerender(false);
    expect(result.current.showPopup).toBe(false);
  });
});
