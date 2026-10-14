import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ManaPanel } from "@/features/alchemy/run-loop/battle/presentation/ui/resources";
import { battlePresentation } from "@/app/battle-presentation";

afterEach(() => {
  cleanup();
  battlePresentation.getState().resetPresentation();
});

it("keeps unchanged crystals mounted through spending, refill, and capacity gain", () => {
  const { rerender } = render(<ManaPanel mana={3} maxMana={4} presentation={battlePresentation} />);
  const gem = (index: number) => screen.getByTestId("mana-panel").querySelector(`[data-mana-index="${index}"]`)!;
  const firstArt = gem(0).querySelector(".mana-dock-full");
  const unchangedToken = gem(0).getAttribute("data-effect-token");
  rerender(<ManaPanel mana={2} maxMana={4} presentation={battlePresentation} />);
  expect(gem(0).querySelector(".mana-dock-full")).toBe(firstArt);
  expect(gem(0).getAttribute("data-effect-token")).toBe(unchangedToken);
  expect(gem(2).getAttribute("data-effect")).toBe("spend");
  rerender(<ManaPanel mana={3} maxMana={4} presentation={battlePresentation} />);
  expect(gem(2).getAttribute("data-effect")).toBe("fill");
  rerender(<ManaPanel mana={4} maxMana={5} presentation={battlePresentation} />);
  expect(gem(4).getAttribute("data-effect")).toBe("gain");
  expect(gem(0).querySelector(".mana-dock-full")).toBe(firstArt);
});

it("caps visible gems with a badge and keeps exact values accessible without a readout", () => {
  render(<ManaPanel mana={14} maxMana={17} presentation={battlePresentation} />);
  expect(screen.getByTestId("mana-panel").querySelectorAll("[data-mana-index]")).toHaveLength(9);
  expect(screen.getByText("+8")).toBeDefined();
  expect(screen.getByRole("button", { name: "Inspect Mana: 14 / 17" })).toBeDefined();
  expect(screen.queryByText("14 / 17")).toBeNull();
  expect(screen.getByTestId("mana-panel").querySelectorAll("[data-outside]")).toHaveLength(0);
});
