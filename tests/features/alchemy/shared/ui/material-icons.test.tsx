import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { HomesteadResourceWallet } from "@/features/alchemy/shared/ui/material-icons";

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
});
