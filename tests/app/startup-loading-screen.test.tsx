import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartupLoadingScreen } from "@/app/startup-loading-screen";
import { INITIAL_LOAD_MIN_DURATION_MS, LOADING_WORD_INTERVAL_MS } from "@/lib/game-constants";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches })),
  );
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

  it("fills the gold header left to right and advances the phrase on each tick", () => {
    const { unmount } = render(<StartupLoadingScreen progress={0.5} />);

    const heading = screen.getByRole("heading", { name: "Alchemy" });
    expect(heading.textContent).toBe("AlchemyAlchemy");
    expect(heading.className).toContain("alchemy-loading-logo-pulse");
    const fillLayer = heading.querySelector<HTMLElement>(".alchemy-loading-logo-fill");
    expect(fillLayer?.style.animationDuration).toBe(`${INITIAL_LOAD_MIN_DURATION_MS}ms`);
    const fill = fillLayer?.querySelector("span");
    expect(fill?.className).not.toContain("boss-title-shine");
    expect(fill?.className).toContain("text-primary");
    const phrase = screen.getByText("Adventure awaits...");
    expect(phrase.tagName).toBe("P");
    expect(phrase.className).toContain("alchemy-loading-word");
    expect(phrase.className).toContain("text-muted-foreground");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");

    act(() => {
      vi.advanceTimersByTime(LOADING_WORD_INTERVAL_MS);
    });

    expect(screen.getByText("Polishing trinkets...")).toBeTruthy();

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renders the header with no timer under reduced motion", () => {
    stubMatchMedia(true);
    render(<StartupLoadingScreen progress={0.5} />);

    const heading = screen.getByRole("heading", { name: "Alchemy" });
    expect(heading.textContent).toBe("AlchemyAlchemy");
    expect(heading.querySelector(".alchemy-loading-logo-fill")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
