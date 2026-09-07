import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CampfireScreen } from "@/features/alchemy/run-loop/screens/campfire-screen";
import { CAMPFIRE_ANIMATION_MS, CAMPFIRE_CONTINUE_DELAY } from "@/lib/game-constants";
import { installRafStub } from "../../../../helpers/animation-test";

describe("CampfireScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    { playerHealth: 20, restoredHealth: 50 },
    { playerHealth: 90, restoredHealth: 100 },
    { playerHealth: 100, restoredHealth: 100 },
  ])("finishes and holds $playerHealth → $restoredHealth before continuing", ({ playerHealth, restoredHealth }) => {
    const frames = installRafStub();
    const onContinue = vi.fn();
    const props = { playerHealth, maxHealth: 100, healFraction: 0.3, onContinue };
    const { rerender } = render(<CampfireScreen {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Rest" }));
    expect(screen.getByText(`${playerHealth} / 100`)).toBeTruthy();

    act(() => frames.shift()?.(CAMPFIRE_ANIMATION_MS / 2));
    const midpoint = Number(screen.getByRole("progressbar", { name: "Health" }).getAttribute("aria-valuenow"));
    expect(midpoint).toBeGreaterThanOrEqual(playerHealth);
    expect(midpoint).toBeLessThanOrEqual(restoredHealth);
    expect(onContinue).not.toHaveBeenCalled();

    act(() => frames.shift()?.(CAMPFIRE_ANIMATION_MS));
    expect(screen.getByText(`${restoredHealth} / 100`)).toBeTruthy();
    expect(screen.getByRole("progressbar").firstElementChild).toHaveProperty("style.width", `${restoredHealth}%`);

    act(() => vi.advanceTimersByTime(CAMPFIRE_CONTINUE_DELAY - 1));
    expect(onContinue).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onContinue).toHaveBeenCalledOnce();

    rerender(<CampfireScreen {...props} playerHealth={restoredHealth} />);
    expect(screen.getByText(`${restoredHealth} / 100`)).toBeTruthy();
    expect(frames).toHaveLength(0);
    act(() => vi.advanceTimersByTime(CAMPFIRE_ANIMATION_MS + CAMPFIRE_CONTINUE_DELAY));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("cancels the pending departure when the screen unmounts", () => {
    const frames = installRafStub();
    const onContinue = vi.fn();
    const { unmount } = render(
      <CampfireScreen playerHealth={20} maxHealth={100} healFraction={0.3} onContinue={onContinue} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rest" }));
    act(() => frames.shift()?.(CAMPFIRE_ANIMATION_MS));
    unmount();
    act(() => vi.advanceTimersByTime(CAMPFIRE_CONTINUE_DELAY));
    expect(onContinue).not.toHaveBeenCalled();
  });
});
