import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CurrencyAmount, GoldCost, GoldDisplay } from "@/features/alchemy/shared/ui/display-elements";
import { resourceGold } from "@/lib/game-data";

describe("display elements", () => {
  afterEach(cleanup);

  it("renders formatted currency amount with suffix and tabular numbers", () => {
    render(<CurrencyAmount amount={1500} suffix=" Gold" className="font-bold" />);
    const amountSpan = screen.getByText("1,500 Gold");
    expect(amountSpan.className).toContain("tabular-nums");
    expect(amountSpan.className).toContain("font-bold");
  });

  it("renders GoldCost with yellow styling", () => {
    const { container } = render(<GoldCost amount={75} />);
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText("75")).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain("text-yellow-300");
    expect(screen.getByRole("img", { name: "Gold" }).getAttribute("src")).toBe(resourceGold);
  });

  it("renders GoldDisplay with the Homestead wallet label and artwork", () => {
    render(<GoldDisplay gold={250} />);
    expect(screen.getByText("Gold")).toBeTruthy();
    expect(screen.getByText("250")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Gold" }).getAttribute("src")).toBe(resourceGold);
  });
});
