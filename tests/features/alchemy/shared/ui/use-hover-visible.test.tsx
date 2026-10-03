import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { useHoverVisible } from "@/features/alchemy/shared/ui/use-hover-visible";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function ControlledHarness({ interactive = true, isHovered }: { interactive?: boolean; isHovered: boolean }) {
  const { wrapperRef, showPopup } = useHoverVisible<HTMLDivElement>({
    holdMs: 160,
    interactive,
    isHovered,
    onHoverStart: () => {},
    onHoverEnd: () => {},
  });
  return (
    <div ref={wrapperRef} data-testid="wrap">
      <span data-testid="showPopup">{String(showPopup)}</span>
    </div>
  );
}

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

  it("showPopup holds through fade when controlled isHovered flips", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<ControlledHarness isHovered={true} />);
    expect(screen.getByTestId("showPopup").textContent).toBe("true");
    rerender(<ControlledHarness isHovered={false} />);
    expect(screen.getByTestId("showPopup").textContent).toBe("true");
    await act(async () => {
      vi.advanceTimersByTime(161);
    });
    expect(screen.getByTestId("showPopup").textContent).toBe("false");
    vi.useRealTimers();
  });

  it("keeps visible when focusWithinGuard and wrapper is focus-within on leave", async () => {
    function FocusGuardHarness() {
      const { wrapperRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible<HTMLDivElement>({
        focusWithinGuard: true,
      });
      return (
        <div ref={wrapperRef} data-testid="wrap">
          <div data-testid="trigger" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            trigger
          </div>
          <span data-testid="visible">{String(visible)}</span>
        </div>
      );
    }
    render(<FocusGuardHarness />);
    const trigger = screen.getByTestId("trigger");
    const wrap = screen.getByTestId("wrap") as HTMLElement;
    await act(async () => {
      fireEvent.mouseEnter(trigger);
    });
    expect(screen.getByTestId("visible").textContent).toBe("true");
    const origMatches = wrap.matches.bind(wrap);
    vi.spyOn(wrap, "matches").mockImplementation((sel: string) =>
      sel === ":focus-within" ? true : origMatches(sel as never),
    );
    await act(async () => {
      fireEvent.mouseLeave(trigger);
    });
    expect(screen.getByTestId("visible").textContent).toBe("true");
    (wrap.matches as unknown as ReturnType<typeof vi.spyOn>).mockImplementation((sel: string) =>
      sel === ":focus-within" ? false : origMatches(sel as never),
    );
    await act(async () => {
      fireEvent.mouseLeave(trigger);
    });
    expect(screen.getByTestId("visible").textContent).toBe("false");
  });

  it("handleBlur closes even when focusWithinGuard is true", async () => {
    function BlurHarness() {
      const { wrapperRef, visible, onMouseEnter, onBlurCapture } = useHoverVisible<HTMLDivElement>({
        focusWithinGuard: true,
      });
      return (
        <div ref={wrapperRef} data-testid="wrap" onBlur={onBlurCapture as unknown as React.FocusEventHandler}>
          <div data-testid="trigger" onMouseEnter={onMouseEnter}>
            trigger
          </div>
          <span data-testid="visible">{String(visible)}</span>
        </div>
      );
    }
    render(<BlurHarness />);
    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId("trigger"));
    });
    expect(screen.getByTestId("visible").textContent).toBe("true");
    await act(async () => {
      fireEvent.blur(screen.getByTestId("wrap"));
    });
    expect(screen.getByTestId("visible").textContent).toBe("false");
  });

  it("interactive=false keeps showPopup false and suppresses callbacks even with holdMs", async () => {
    vi.useFakeTimers();
    const onHoverStart = vi.fn();
    const onHoverEnd = vi.fn();
    function InteractiveHoldHarness({ interactive }: { interactive: boolean }) {
      const { wrapperRef, showPopup, handleHoverStart, handleMouseLeave } = useHoverVisible<HTMLDivElement>({
        holdMs: 160,
        interactive,
        isHovered: true,
        onHoverStart,
        onHoverEnd,
      });
      return (
        <div ref={wrapperRef} data-testid="wrap">
          <button data-testid="start" onMouseEnter={handleHoverStart} onMouseLeave={handleMouseLeave}>
            start
          </button>
          <span data-testid="showPopup">{String(showPopup)}</span>
        </div>
      );
    }
    const { rerender } = render(<InteractiveHoldHarness interactive={false} />);
    expect(screen.getByTestId("showPopup").textContent).toBe("false");
    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId("start"));
    });
    expect(onHoverStart).not.toHaveBeenCalled();
    fireEvent.mouseLeave(screen.getByTestId("start"));
    expect(onHoverEnd).not.toHaveBeenCalled();
    rerender(<InteractiveHoldHarness interactive={true} />);
    expect(screen.getByTestId("showPopup").textContent).toBe("true");
    fireEvent.mouseEnter(screen.getByTestId("start"));
    fireEvent.mouseLeave(screen.getByTestId("start"));
    expect(onHoverStart).toHaveBeenCalledOnce();
    expect(onHoverEnd).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
