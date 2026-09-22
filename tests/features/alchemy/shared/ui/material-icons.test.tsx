import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { HomesteadResourceWallet, ResourcePill } from "@/features/alchemy/shared/ui/material-icons";

const LABELS = ["Gold", "Wood", "Stone", "Iron", "Food", "Herbs", "Hide", "Gems"];

describe("HomesteadResourceWallet", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows every resource with its current amount", () => {
    render(<HomesteadResourceWallet gold={100} materialInventory={emptyInventory()} />);
    for (const label of LABELS) {
      expect(screen.getByRole("img", { name: label })).toBeTruthy();
      expect(screen.getByText(label).parentElement?.textContent).toContain(label === "Gold" ? "100" : "0");
    }
  });

  it("truncates long custom titles with a full-text tooltip", () => {
    const longTitle = "A very long custom resource title that must truncate";
    render(<ResourcePill resource="wood" title={longTitle} amount={5} />);
    const label = screen.getByText(longTitle);
    expect(label.getAttribute("title")).toBe(longTitle);
  });
});
