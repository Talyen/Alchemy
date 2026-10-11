import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FadeSlot } from "@/features/alchemy/shared/ui/use-fade";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";

describe("FadeSlot", () => {
  it("replaces nested identities together instead of starting a second outgoing fade", () => {
    vi.useFakeTimers();
    const view = (identity: string) => (
      <FadeSlot swapKey={identity}>
        <h2>{identity} heading</h2>
        <FadeSlot swapKey={identity}>
          <p>{identity} content</p>
        </FadeSlot>
      </FadeSlot>
    );
    const { rerender } = render(view("first"));
    rerender(view("second"));
    expect(screen.getByText("first heading")).toBeTruthy();
    act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
    expect(screen.getByText("second heading")).toBeTruthy();
    expect(screen.getByText("second content")).toBeTruthy();
    expect(screen.queryByText("first content")).toBeNull();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps outgoing and artwork-pending content inert during a swap", async () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const { rerender } = render(
      <FadeSlot swapKey="first" data-testid="slot" onReady={onReady}>
        <button>First reward</button>
      </FadeSlot>,
    );
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByTestId("slot").hasAttribute("inert")).toBe(false);
    expect(onReady).toHaveBeenCalledExactlyOnceWith("first");
    onReady.mockClear();
    rerender(
      <FadeSlot swapKey="second" data-testid="slot" onReady={onReady}>
        <button>Next reward</button>
      </FadeSlot>,
    );
    expect(screen.getByTestId("slot").hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("button", { name: "First reward", hidden: true })).toBeTruthy();
    expect(onReady).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(resolveGameDelay(MOTION_FADE_MS)));
    expect(screen.getByTestId("slot").hasAttribute("inert")).toBe(true);
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByTestId("slot").hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("button", { name: "Next reward" })).toBeTruthy();
    expect(onReady).toHaveBeenCalledExactlyOnceWith("second");
  });
});
