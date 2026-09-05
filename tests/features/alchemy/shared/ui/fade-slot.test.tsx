import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FadeSlot } from "@/features/alchemy/shared/ui/use-fade";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";

describe("FadeSlot", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
