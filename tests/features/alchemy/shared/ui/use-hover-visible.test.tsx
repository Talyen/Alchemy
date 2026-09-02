import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useHoverVisible } from "@/features/alchemy/shared/ui/use-hover-visible";

afterEach(() => cleanup());

function HoverHarness({
  holdMs = 0,
  interactive,
  isHovered,
}: {
  holdMs?: number;
  interactive?: boolean;
  isHovered?: boolean;
}) {
  const { triggerRef, wrapperRef, visible, mounted, onMouseEnter, onMouseLeave } = useHoverVisible<HTMLDivElement>({
    holdMs,
    interactive,
    isHovered,
  });
  return (
    <div>
      <div ref={triggerRef} data-testid="trigger" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        trigger
      </div>
      <div ref={wrapperRef} data-testid="wrapper" />
      <span data-testid="visible">{String(visible)}</span>
      <span data-testid="mounted">{String(mounted)}</span>
    </div>
  );
}

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
  it("toggles visible on mouse enter/leave in uncontrolled mode", async () => {
    render(<HoverHarness />);
    expect(screen.getByTestId("visible").textContent).toBe("false");
    await userEvent.hover(screen.getByTestId("trigger"));
    expect(screen.getByTestId("visible").textContent).toBe("true");
    await userEvent.unhover(screen.getByTestId("trigger"));
    expect(screen.getByTestId("visible").textContent).toBe("false");
  });

  it("holds mounted after visible becomes false when holdMs > 0", async () => {
    vi.useFakeTimers();
    render(<HoverHarness holdMs={160} />);
    const trigger = screen.getByTestId("trigger");
    await act(async () => {
      fireEvent.mouseEnter(trigger);
    });
    expect(screen.getByTestId("mounted").textContent).toBe("true");
    await act(async () => {
      fireEvent.mouseLeave(trigger);
    });
    expect(screen.getByTestId("mounted").textContent).toBe("true");
    await act(async () => {
      vi.advanceTimersByTime(161);
    });
    expect(screen.getByTestId("mounted").textContent).toBe("false");
    vi.useRealTimers();
  });

  it("respects interactive=false in controlled mode", () => {
    const { rerender } = render(<ControlledHarness interactive={false} isHovered={true} />);
    expect(screen.getByTestId("showPopup").textContent).toBe("false");
    rerender(<ControlledHarness interactive={true} isHovered={true} />);
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
      const { wrapperRef, showPopup, handleHoverStart } = useHoverVisible<HTMLDivElement>({
        holdMs: 160,
        interactive,
        isHovered: true,
        onHoverStart,
        onHoverEnd,
      });
      return (
        <div ref={wrapperRef} data-testid="wrap">
          <button data-testid="start" onMouseEnter={handleHoverStart as unknown as React.MouseEventHandler}>
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
    rerender(<InteractiveHoldHarness interactive={true} />);
    expect(screen.getByTestId("showPopup").textContent).toBe("true");
    vi.useRealTimers();
  });
});
