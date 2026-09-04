import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KeywordProgressCard } from "@/features/alchemy/run-loop/screens/keyword-progress-card";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";

function barFillWidth(container: HTMLElement): string | null {
  return container.querySelector('[role="progressbar"] > div')?.getAttribute("style") ?? null;
}

describe("KeywordProgressCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Lv# with keyword color and a thicker progress bar, without XP gain or progress text", () => {
    const { container } = render(<KeywordProgressCard kw="physical" totalXP={15} animate={false} size="md" />);

    expect(screen.getByText("Physical")).toBeTruthy();
    expect(screen.queryByText("+5 XP")).toBeNull();
    expect(screen.queryByText("0/20")).toBeNull();

    const lvLabel = screen.getByText("Lv2");
    expect(lvLabel).toBeTruthy();
    expect(lvLabel.className).toContain(keywordDefinitions.physical.colorClass);

    const progressBar = container.querySelector(".h-1\\.5");
    expect(progressBar).toBeTruthy();
  });

  it("holds the bar empty until animate, then sweeps to the final progress", () => {
    const { container, rerender } = render(<KeywordProgressCard kw="physical" totalXP={15} animate={false} />);

    expect(barFillWidth(container)).toContain("width: 0%");

    rerender(<KeywordProgressCard kw="physical" totalXP={15} animate={true} />);

    expect(barFillWidth(container)).toContain("width: 25%");
    expect(barFillWidth(container)).toContain("width 1000ms ease-out");
  });
});
