import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartupLoadingScreen } from "@/app/startup-loading-screen";
import { LOADING_WORD_INTERVAL_MS } from "@/lib/game-constants";

describe("StartupLoadingScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("advances to a different word when the random source repeats", () => {
    const { unmount } = render(<StartupLoadingScreen progress={0.5} />);

    expect(screen.getByRole("heading", { name: "Alchemy" })).toBeTruthy();
    expect(screen.getByText("Forging...")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(LOADING_WORD_INTERVAL_MS);
    });

    expect(screen.getByText("Growing...")).toBeTruthy();

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
