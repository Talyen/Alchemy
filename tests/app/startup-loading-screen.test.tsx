import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartupLoadingScreen } from "@/app/startup-loading-screen";
import { LOADING_WORD_INTERVAL_MS } from "@/lib/game-constants";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches })),
  );
}

function litLetterCount() {
  const letters = screen.getByRole("heading", { name: "Alchemy" }).querySelectorAll("span");
  return Array.from(letters).filter((span) => (span as HTMLElement).style.color === "transparent").length;
}

describe("StartupLoadingScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("advances the phrase and lights the next letter on each tick", () => {
    const { unmount } = render(<StartupLoadingScreen progress={0.5} />);

    expect(screen.getByRole("heading", { name: "Alchemy" })).toBeTruthy();
    expect(screen.getByText("Forging...")).toBeTruthy();
    expect(litLetterCount()).toBe(1);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");

    act(() => {
      vi.advanceTimersByTime(LOADING_WORD_INTERVAL_MS);
    });

    expect(screen.getByText("Growing...")).toBeTruthy();
    expect(litLetterCount()).toBe(2);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("loops the ignition back down instead of sticking at full", () => {
    render(<StartupLoadingScreen progress={0.5} />);

    act(() => {
      vi.advanceTimersByTime(LOADING_WORD_INTERVAL_MS * 6);
    });
    expect(litLetterCount()).toBe(7);

    act(() => {
      vi.advanceTimersByTime(LOADING_WORD_INTERVAL_MS);
    });
    expect(litLetterCount()).toBe(6);
  });

  it("renders the full lit word with no timer under reduced motion", () => {
    stubMatchMedia(true);
    render(<StartupLoadingScreen progress={0.5} />);

    expect(litLetterCount()).toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });
});
