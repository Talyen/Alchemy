// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEmptyGearBoardPositionsByCharacter, createEmptyGearLoadouts } from "@/lib/gear";
import { useGearStore } from "../../../../helpers/gameplay-store-test";
import {
  createArmoryInventories,
  installArmoryScreenTestHooks,
  renderArmoryScreen,
} from "./armory/armory-screen-test-helpers";

describe("ArmoryScreen core", () => {
  installArmoryScreenTestHooks();

  it("renders the armory panels and inventory", () => {
    renderArmoryScreen();

    expect(screen.getByRole("heading", { name: "Armory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Inventory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Equipment" })).toBeTruthy();
    expect(document.querySelector('[data-gear-title="Leather Helm"]')).not.toBeNull();
    expect(document.querySelector('[data-gear-title="Leather Armor"]')).not.toBeNull();
  });

  it("switches to an unlocked character", async () => {
    const user = userEvent.setup();
    renderArmoryScreen({ finishedRunCharacters: ["knight", "rogue"] });

    await user.click(screen.getByRole("button", { name: "Rogue" }));

    expect(screen.getByRole("heading", { name: "Rogue" })).toBeTruthy();
  });

  it("disables characters whose prerequisite has not finished", () => {
    renderArmoryScreen({ finishedRunCharacters: ["knight"] });

    expect(screen.getByRole("button", { name: "Rogue" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Wizard (Locked)" })).toHaveProperty("disabled", true);
  });

  it("shows browse-only feedback and blocks equipped-item interaction", () => {
    const onUnequip = vi.fn();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.helm = "gear-helm";
    renderArmoryScreen({ browseOnly: true, loadouts, onUnequip });

    expect(screen.getByText("Equipment can be changed after combat.")).toBeTruthy();
    screen.getByLabelText("Helm equipment slot").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(onUnequip).not.toHaveBeenCalled();
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

  it("hides equipped gear from the inventory board", () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "gear-body";
    renderArmoryScreen({ loadouts });

    expect(document.querySelector('[data-gear-title="Leather Helm"]')).not.toBeNull();
    expect(document.querySelector('[data-gear-title="Leather Armor"]')).toBeNull();
  });

  it("cleans stale saved board coordinates on mount", async () => {
    const inventories = createArmoryInventories();
    const loadouts = createEmptyGearLoadouts();
    useGearStore.getState().initialize(inventories, loadouts, {
      ...createEmptyGearBoardPositionsByCharacter(),
      knight: {
        "gear-helm": { col: 1, row: 1 },
        "stale-item-id": { col: 3, row: 3 },
      },
    });

    renderArmoryScreen({ inventories, loadouts });

    await waitFor(() => {
      const positions = useGearStore.getState().boardPositionsByCharacter.knight;
      expect(positions["stale-item-id"]).toBeUndefined();
      expect(positions["gear-helm"]).toEqual({ col: 1, row: 1 });
      expect(positions["gear-body"]).toBeDefined();
    });
  });
});
