import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { useFadePresence, useSequentialFadeSwap, FadeSlot } from "@/features/alchemy/shared/ui/use-fade";
import { MOTION_FADE_MS } from "@/lib/game-constants";

afterEach(() => cleanup());

function PresenceHarness({ open }: { open: boolean }) {
  const { mounted, phase } = useFadePresence(open, MOTION_FADE_MS);
  return (
    <div>
      <span data-testid="mounted">{String(mounted)}</span>
      <span data-testid="phase">{phase}</span>
    </div>
  );
}

function SwapHarness({ target }: { target: string }) {
  const { shown, phase } = useSequentialFadeSwap({ target, durationMs: MOTION_FADE_MS, initialPhase: "idle" });
  return (
    <div>
      <span data-testid="shown">{shown}</span>
      <span data-testid="phase">{phase}</span>
    </div>
  );
}

describe("useFadePresence", () => {
  it("mounts on open and animates exit before unmount", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<PresenceHarness open={false} />);
    expect(screen.getByTestId("mounted").textContent).toBe("false");
    rerender(<PresenceHarness open={true} />);
    expect(screen.getByTestId("mounted").textContent).toBe("true");
    expect(screen.getByTestId("phase").textContent).toBe("enter");
    rerender(<PresenceHarness open={false} />);
    expect(screen.getByTestId("phase").textContent).toBe("exit");
    expect(screen.getByTestId("mounted").textContent).toBe("true");
    await act(async () => {
      vi.advanceTimersByTime(MOTION_FADE_MS + 5);
    });
    expect(screen.getByTestId("mounted").textContent).toBe("false");
    vi.useRealTimers();
  });
});

describe("useSequentialFadeSwap", () => {
  it("holds shown through exit then swaps to enter", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<SwapHarness target="a" />);
    expect(screen.getByTestId("shown").textContent).toBe("a");
    rerender(<SwapHarness target="b" />);
    expect(screen.getByTestId("phase").textContent).toBe("exit");
    expect(screen.getByTestId("shown").textContent).toBe("a");
    await act(async () => {
      vi.advanceTimersByTime(MOTION_FADE_MS + 5);
    });
    expect(screen.getByTestId("shown").textContent).toBe("b");
    expect(screen.getByTestId("phase").textContent).toBe("enter");
    vi.useRealTimers();
  });

  it("cancels exit if target reverts before timeout", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<SwapHarness target="a" />);
    rerender(<SwapHarness target="b" />);
    expect(screen.getByTestId("phase").textContent).toBe("exit");
    rerender(<SwapHarness target="a" />);
    await act(async () => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByTestId("phase").textContent).toBe("enter");
    vi.useRealTimers();
  });
});

describe("FadeSlot", () => {
  it("holds outgoing children while exiting and swaps after fade", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <FadeSlot swapKey="a">
        <span data-testid="child">A</span>
      </FadeSlot>,
    );
    expect(screen.getByTestId("child").textContent).toBe("A");
    rerender(
      <FadeSlot swapKey="b">
        <span data-testid="child">B</span>
      </FadeSlot>,
    );
    expect(screen.getByTestId("child").textContent).toBe("A");
    await act(async () => {
      vi.advanceTimersByTime(MOTION_FADE_MS + 5);
    });
    expect(screen.getByTestId("child").textContent).toBe("B");
    vi.useRealTimers();
  });
});
