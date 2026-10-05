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
  it("keeps inspection visible until both pointer and keyboard focus leave", () => {
    function InspectionHover() {
      const { wrapperRef, handleHoverStart, handleMouseLeave, handleBlur, visible } = useHoverVisible();
      return (
        <div ref={wrapperRef} data-testid="wrapper" onMouseEnter={handleHoverStart} onMouseLeave={handleMouseLeave}>
          <button onFocus={handleHoverStart} onBlur={handleBlur}>
            Inspect
          </button>
          <span data-testid="visible">{String(visible)}</span>
        </div>
      );
    }
    render(<InspectionHover />);
    const wrapper = screen.getByTestId("wrapper");
    const trigger = screen.getByRole("button", { name: "Inspect" });
    fireEvent.mouseEnter(wrapper);
    fireEvent.focus(trigger);
    fireEvent.mouseLeave(wrapper);
    expect(screen.getByTestId("visible").textContent).toBe("true");
    fireEvent.blur(trigger);
    expect(screen.getByTestId("visible").textContent).toBe("false");

    fireEvent.focus(trigger);
    fireEvent.mouseEnter(wrapper);
    fireEvent.blur(trigger);
    expect(screen.getByTestId("visible").textContent).toBe("true");
    fireEvent.mouseLeave(wrapper);
    expect(screen.getByTestId("visible").textContent).toBe("false");
  });

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
