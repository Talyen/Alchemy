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
    const { rerender } = render(
      <FadeSlot swapKey="first" data-testid="slot">
        <button>First reward</button>
      </FadeSlot>,
    );
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByTestId("slot").hasAttribute("inert")).toBe(false);
    rerender(
      <FadeSlot swapKey="second" data-testid="slot">
        <button>Next reward</button>
      </FadeSlot>,
    );
    expect(screen.getByTestId("slot").hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("button", { name: "First reward", hidden: true })).toBeTruthy();
    act(() => vi.advanceTimersByTime(resolveGameDelay(MOTION_FADE_MS)));
    expect(screen.getByTestId("slot").hasAttribute("inert")).toBe(true);
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByTestId("slot").hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("button", { name: "Next reward" })).toBeTruthy();
  });

  it("holds outgoing children and wrapper className until opacity is 0", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <FadeSlot swapKey="cards" className="grid-cols-4" data-testid="fade-slot">
        <span>Cards</span>
      </FadeSlot>,
    );

    expect(screen.getByText("Cards")).toBeTruthy();
    expect(screen.getByTestId("fade-slot").className).toContain("grid-cols-4");

    rerender(
      <FadeSlot swapKey="bestiary" className="grid-cols-3" data-testid="fade-slot">
        <span>Bestiary</span>
      </FadeSlot>,
    );

    expect(screen.getByText("Cards")).toBeTruthy();
    expect(screen.queryByText("Bestiary")).toBeNull();
    expect(screen.getByTestId("fade-slot").className).toContain("grid-cols-4");
    expect(screen.getByTestId("fade-slot").className).not.toContain("grid-cols-3");

    act(() => {
      vi.advanceTimersByTime(resolveGameDelay(MOTION_FADE_MS));
    });

    expect(screen.getByText("Bestiary")).toBeTruthy();
    expect(screen.queryByText("Cards")).toBeNull();
    expect(screen.getByTestId("fade-slot").className).toContain("grid-cols-3");
    expect(screen.getByTestId("fade-slot").className).not.toContain("grid-cols-4");
  });
});
