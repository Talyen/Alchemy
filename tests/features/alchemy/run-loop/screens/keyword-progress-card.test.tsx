import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KeywordProgressCard } from "@/features/alchemy/run-loop/screens/keyword-progress-card";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";

describe("KeywordProgressCard", () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let cancelRafSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rafCallbacks = [];
    cancelRafSpy = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", cancelRafSpy);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function advanceNextFrame(time: number) {
    const cb = rafCallbacks.shift();
    if (cb) {
      act(() => {
        cb(time);
      });
    }
  }

  it("renders Lv# with keyword color and thicker progress bar, omitting raw XP copy", () => {
    const { container } = render(
      <KeywordProgressCard kw="physical" runXP={5} totalXP={15} animate={false} size="md" />,
    );

    expect(screen.getByText("Physical")).toBeTruthy();
    expect(screen.queryByText("+5")).toBeNull();
    expect(screen.queryByText("10/20")).toBeNull();

    const lvLabel = screen.getByText("Lv1");
    expect(lvLabel).toBeTruthy();
    expect(lvLabel.className).toContain(keywordDefinitions.physical.colorClass);

    const progressBar = container.querySelector(".h-1\\.5");
    expect(progressBar).toBeTruthy();
  });

  it("animates XP and updates Lv# when crossing talent thresholds", () => {
    render(<KeywordProgressCard kw="physical" runXP={12} totalXP={20} animate={true} />);

    expect(screen.getByText("Lv0")).toBeTruthy();

    advanceNextFrame(0);
    expect(screen.getByText("Lv0")).toBeTruthy();

    advanceNextFrame(200);
    expect(screen.getByText("Lv1")).toBeTruthy();

    advanceNextFrame(1000);
    expect(screen.getByText("Lv1")).toBeTruthy();
  });

  it("handles multiple level-ups across an animation window", () => {
    render(<KeywordProgressCard kw="nature" runXP={30} totalXP={35} animate={true} />);

    expect(screen.getByText("Lv0")).toBeTruthy();

    advanceNextFrame(0);
    expect(screen.getByText("Lv0")).toBeTruthy();

    advanceNextFrame(200);
    expect(screen.getByText("Lv1")).toBeTruthy();

    advanceNextFrame(900);
    expect(screen.getByText("Lv2")).toBeTruthy();

    advanceNextFrame(1000);
    expect(screen.getByText("Lv2")).toBeTruthy();
  });

  it("cancels pending animation frame on unmount", () => {
    const { unmount } = render(<KeywordProgressCard kw="burn" runXP={10} totalXP={20} animate={true} />);

    expect(rafCallbacks).toHaveLength(1);
    unmount();
    expect(cancelRafSpy).toHaveBeenCalledWith(1);
  });

  it("resets and cancels animation when animate switches to false", () => {
    const { rerender } = render(<KeywordProgressCard kw="burn" runXP={12} totalXP={20} animate={true} />);

    advanceNextFrame(0);
    advanceNextFrame(200);
    expect(screen.getByText("Lv1")).toBeTruthy();

    rerender(<KeywordProgressCard kw="burn" runXP={12} totalXP={20} animate={false} />);
    expect(cancelRafSpy).toHaveBeenCalled();
    expect(screen.getByText("Lv0")).toBeTruthy();
  });

  it("restarts animation when XP props update", () => {
    const { rerender } = render(<KeywordProgressCard kw="burn" runXP={5} totalXP={5} animate={true} />);

    advanceNextFrame(0);
    advanceNextFrame(1000);
    expect(screen.getByText("Lv0")).toBeTruthy();

    rerender(<KeywordProgressCard kw="burn" runXP={15} totalXP={20} animate={true} />);

    advanceNextFrame(0);
    advanceNextFrame(500);
    expect(screen.getByText("Lv1")).toBeTruthy();
  });
});
