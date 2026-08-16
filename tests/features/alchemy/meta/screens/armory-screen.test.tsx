// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyGearLoadouts } from "@/lib/gear";
import {
  createArmoryInventories,
  installArmoryScreenTestHooks,
  renderArmoryScreen,
} from "./armory/armory-screen-test-helpers";

describe("ArmoryScreen core", () => {
  installArmoryScreenTestHooks();

  it("renders equipment slots and the matching item picker", () => {
    renderArmoryScreen();

    expect(screen.getByRole("heading", { name: "Armory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Equipment" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Weapon" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Weapon 1" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Crafting" })).toBeTruthy();
    expect(document.querySelector('[data-gear-title="Longsword"]')).not.toBeNull();
    expect(document.querySelector('[data-gear-title="Leather Armor"]')).toBeNull();
  });

  it("filters the picker to the selected equipment slot", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Armor equipment slot"));
    await waitFor(() => {
      expect(document.querySelector('[data-gear-title="Leather Armor"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-gear-title="Longsword"]')).toBeNull();
  });

  it("hides the equipped item from inventory and unequips from the selected slot", async () => {
    const user = userEvent.setup();
    const onEquip = vi.fn();
    const onUnequip = vi.fn();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = "gear-sword";
    renderArmoryScreen({ onEquip, onUnequip, loadouts });

    expect(document.querySelector('[data-testid="armory-inventory-item"][data-gear-title="Longsword"]')).toBeNull();

    await user.click(screen.getByLabelText("Main-hand equipment slot"));
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

  it("paginates matching inventory to six items per page", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 7 }, (_, index) => ({
      instanceId: `gear-sword-${index}`,
      definitionId: "longsword-basic" as const,
      affixes: [],
    }));
    renderArmoryScreen({ inventories: createArmoryInventories(items) });

    expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(6);
    expect(document.querySelectorAll('[data-testid="armory-inventory-filler"]')).toHaveLength(0);

    await user.click(screen.getByLabelText("Next page"));
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(1);
      expect(document.querySelectorAll('[data-testid="armory-inventory-filler"]')).toHaveLength(5);
    });
  });

  it("shows shine borders on astral equipped and inventory tiles, not on basic tiles", async () => {
    const user = userEvent.setup();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "gear-astral-armor";
    renderArmoryScreen({
      inventories: createArmoryInventories([
        { instanceId: "gear-sword", definitionId: "longsword-basic", affixes: [] },
        { instanceId: "gear-astral-sword", definitionId: "longsword-astral", affixes: [] },
        { instanceId: "gear-astral-armor", definitionId: "leather-armor-astral", affixes: [] },
      ]),
      loadouts,
    });

    const armorSlot = screen.getByLabelText("Armor equipment slot");
    expect(armorSlot.querySelector(".shine-border")).not.toBeNull();
    expect(armorSlot.className).toMatch(/has-shine-border/);
    expect(armorSlot.className).toMatch(/card-interactive-glow/);
    expect(armorSlot.className).not.toMatch(/card-interactive-selected/);

    const mainHandSlot = screen.getByLabelText("Main-hand equipment slot");
    expect(mainHandSlot.querySelector(".shine-border")).toBeNull();
    expect(mainHandSlot.className).toMatch(/card-interactive-selected/);

    const astralInventory = document.querySelector(
      '[data-testid="armory-inventory-item"][data-gear-title="Astral Longsword"]',
    );
    const basicInventory = document.querySelector('[data-testid="armory-inventory-item"][data-gear-title="Longsword"]');
    expect(astralInventory?.querySelector(".shine-border")).not.toBeNull();
    expect(astralInventory?.querySelector(".card-interactive-glow")).not.toBeNull();
    expect(astralInventory?.querySelector(".has-shine-border")).not.toBeNull();
    expect(basicInventory?.querySelector(".shine-border")).toBeNull();
    expect(basicInventory?.querySelector(".card-interactive-glow")).not.toBeNull();

    await user.click(armorSlot);
    expect(armorSlot.className).toMatch(/card-interactive-selected/);
    expect(armorSlot.className).toMatch(/has-shine-border/);
    expect(armorSlot.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps a 2×3 inventory footprint when the selected slot has no items", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Amulet equipment slot"));
    await waitFor(() => {
      expect(screen.getByText("No items for this slot")).toBeTruthy();
      expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(0);
      expect(document.querySelectorAll('[data-testid="armory-inventory-filler"]')).toHaveLength(6);
    });
  });
});
