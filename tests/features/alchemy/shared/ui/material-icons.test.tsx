import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { HomesteadResourceWallet, ResourcePill } from "@/features/alchemy/shared/ui/material-icons";

const LABELS = ["Gold", "Wood", "Stone", "Iron", "Food", "Herbs", "Hide", "Gems"];

describe("HomesteadResourceWallet", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all eight resources at full size", () => {
    render(<HomesteadResourceWallet gold={100} materialInventory={emptyInventory()} />);
    for (const label of LABELS) {
      const pill = screen.getByText(label);
      expect(pill.classList.contains("sm:text-sm")).toBe(true);
      expect(pill.classList.contains("truncate")).toBe(true);
      expect(pill.getAttribute("title")).toBe(label);
    }
  });

  it("truncates long custom titles with a full-text tooltip", () => {
    const longTitle = "A very long custom resource title that must truncate";
    render(<ResourcePill resource="wood" title={longTitle} amount={5} />);
    const label = screen.getByText(longTitle);
    expect(label.classList.contains("truncate")).toBe(true);
    expect(label.getAttribute("title")).toBe(longTitle);
  });
});
