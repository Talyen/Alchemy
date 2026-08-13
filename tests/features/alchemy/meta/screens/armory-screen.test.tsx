// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyGearLoadouts } from "@/lib/gear";
import { installArmoryScreenTestHooks, renderArmoryScreen } from "./armory/armory-screen-test-helpers";

describe("ArmoryScreen core", () => {
  installArmoryScreenTestHooks();

  it("renders equipment slots and the matching item picker", () => {
    renderArmoryScreen();

    expect(screen.getByRole("heading", { name: "Armory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Equipment" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Crafting" })).toBeTruthy();
    expect(document.querySelector('[data-gear-title="Longsword"]')).not.toBeNull();
    expect(document.querySelector('[data-gear-title="Leather Armor"]')).toBeNull();
  });

  it("filters the picker to the selected equipment slot", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Armor equipment slot"));
    expect(document.querySelector('[data-gear-title="Leather Armor"]')).not.toBeNull();
    expect(document.querySelector('[data-gear-title="Longsword"]')).toBeNull();
  });

  it("equips on click and unequips when clicking the equipped item", async () => {
    const user = userEvent.setup();
    const onEquip = vi.fn();
    const onUnequip = vi.fn();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = "gear-sword";
    renderArmoryScreen({ onEquip, onUnequip, loadouts });

    await user.click(screen.getByLabelText("Longsword"));
    expect(onUnequip).toHaveBeenCalledWith("knight", "main-hand");
  });

  it("switches to an unlocked character", async () => {
    const user = userEvent.setup();
    renderArmoryScreen({ finishedRunCharacters: ["knight", "rogue"] });

    await user.click(screen.getByRole("button", { name: "Rogue" }));

    expect(screen.getByRole("button", { name: "Rogue" }).className).toMatch(/ring-/);
  });

  it("disables characters whose prerequisite has not finished", () => {
    renderArmoryScreen({ finishedRunCharacters: ["knight"] });

    expect(screen.getByRole("button", { name: "Rogue" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Wizard (Locked)" })).toHaveProperty("disabled", true);
  });

  it("shows browse-only feedback", () => {
    const onUnequip = vi.fn();
    renderArmoryScreen({ browseOnly: true, onUnequip });

    expect(screen.getByText("Equipment can be changed after combat.")).toBeTruthy();
  });

  it("renders the development gear-spawn action when provided", async () => {
    const onSpawnDevGear = vi.fn();
    renderArmoryScreen({ onSpawnDevGear });

    if (!import.meta.env.DEV) {
      expect(screen.queryByLabelText("Spawn random gear")).toBeNull();
      return;
    }

    await userEvent.setup().click(screen.getByLabelText("Spawn random gear"));
    expect(onSpawnDevGear).toHaveBeenCalledWith("knight");
  });
});
