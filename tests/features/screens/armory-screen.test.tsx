// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArmoryScreen } from "@/features/alchemy/meta/screens/armory-screen";
import { createEmptyGearLoadouts } from "@/lib/gear";
import type { GearInstance } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

describe("ArmoryScreen", () => {
  const mockInventory: GearInstance[] = [
    { instanceId: "gear-helm", definitionId: "leather-helm-basic", affixes: [] },
    { instanceId: "gear-body", definitionId: "leather-armor-basic", affixes: [] },
  ];

  beforeEach(() => {
    useGearStore.getState().reset();
    localStorage.clear();
    vi.clearAllMocks();

    // Stub pointer capture APIs for jsdom compatibility
    HTMLDivElement.prototype.setPointerCapture = vi.fn();
    HTMLDivElement.prototype.releasePointerCapture = vi.fn();
    HTMLDivElement.prototype.hasPointerCapture = vi.fn(() => false);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders headers and panels correctly", () => {
    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    // Verify main screen headers
    expect(screen.getByRole("heading", { name: "Armory" }).isConnected).toBe(true);
    expect(screen.getByRole("heading", { name: "Inventory" }).isConnected).toBe(true);
    expect(screen.getByRole("heading", { name: "Equipment" }).isConnected).toBe(true);

    // Gear tiles expose titles via data-gear-title (not always plain text nodes)
    expect(document.querySelector('[data-gear-title="Leather Helm"]')).not.toBeNull();
    expect(document.querySelector('[data-gear-title="Leather Armor"]')).not.toBeNull();
  });

  it("switches characters when tab buttons are clicked", async () => {
    const user = userEvent.setup();
    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight", "rogue"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    // Initial character panel shows Knight
    expect(screen.getByRole("heading", { name: "Knight" }).isConnected).toBe(true);

    // Click on Rogue tab
    const rogueTab = screen.getByRole("button", { name: "Rogue" });
    await user.click(rogueTab);

    // Header updates to Rogue
    expect(screen.getByRole("heading", { name: "Rogue" }).isConnected).toBe(true);
  });

  it("stays in salvage mode after confirming a salvage (multi-item flow)", async () => {
    const user = userEvent.setup();
    const onSalvageMock = vi.fn();

    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={onSalvageMock}
      />,
    );

    // Click the Trash / Salvage Mode button
    const salvageModeBtn = screen.getByLabelText("Salvage Gear");
    await user.click(salvageModeBtn);

    expect(screen.getByLabelText("Cancel salvage").isConnected).toBe(true);
    const helmTile = screen.getByRole("button", { name: "Salvage Leather Helm" });
    await user.click(helmTile);

    // Verify confirmation modal elements are visible
    expect(screen.getByText("Salvage Gear?").isConnected).toBe(true);
    expect(screen.getByText(/Permanently salvage Leather Helm/).isConnected).toBe(true);

    // Confirm salvage — salvage mode must remain active for the next item
    const confirmBtn = screen.getByRole("button", { name: "Salvage" });
    await user.click(confirmBtn);

    expect(onSalvageMock).toHaveBeenCalledWith("gear-helm");
    expect(screen.getByLabelText("Cancel salvage").isConnected).toBe(true);
  });

  it("exits salvage mode when clicking outside inventory gear", async () => {
    const user = userEvent.setup();
    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Salvage Gear"));
    expect(screen.getByLabelText("Cancel salvage").isConnected).toBe(true);

    await user.click(screen.getByRole("heading", { name: "Knight" }));
    expect(screen.getByLabelText("Salvage Gear").isConnected).toBe(true);
  });

  it("exits salvage mode when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Salvage Gear"));
    await user.keyboard("{Escape}");
    expect(screen.getByLabelText("Salvage Gear").isConnected).toBe(true);
  });

  it("exits salvage mode on right click", async () => {
    const user = userEvent.setup();
    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Salvage Gear"));
    await user.pointer({ target: screen.getByTestId("armory-inventory-board"), keys: "[MouseRight]" });
    expect(screen.getByLabelText("Salvage Gear").isConnected).toBe(true);
  });

  it("renders the dev spawn button when onSpawnDevGear is provided in dev builds", async () => {
    const onSpawnDevGear = vi.fn();
    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
        onSpawnDevGear={onSpawnDevGear}
      />,
    );

    if (!import.meta.env.DEV) {
      expect(screen.queryByLabelText("Spawn random gear")).toBeNull();
      return;
    }

    const spawnBtn = screen.getByLabelText("Spawn random gear");
    await userEvent.setup().click(spawnBtn);
    expect(onSpawnDevGear).toHaveBeenCalledTimes(1);
  });

  it("shows browse-only banner when combat is active", () => {
    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={true}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    expect(screen.getByText("Equipment can be changed after combat.").isConnected).toBe(true);
  });

  it("disables locked character tabs until the previous class is finished", () => {
    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    const wizardTab = screen.getByRole("button", { name: "Wizard (Locked)" });
    const rogueTab = screen.getByRole("button", { name: "Rogue" });
    expect(wizardTab).toHaveProperty("disabled", true);
    expect(rogueTab).toHaveProperty("disabled", false);
  });

  it("hides equipped gear from the inventory board", () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "gear-body";

    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={loadouts}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    expect(document.querySelector('[data-gear-title="Leather Helm"]')).not.toBeNull();
    expect(document.querySelector('[data-gear-title="Leather Armor"]')).toBeNull();
  });

  it("automatically cleans up stale saved coordinates in the gear store on mount", async () => {
    const initialPositions = {
      "gear-helm": { col: 1, row: 1 },
      "stale-item-id": { col: 3, row: 3 },
    };
    useGearStore.getState().initialize(mockInventory, createEmptyGearLoadouts(), initialPositions);

    render(
      <ArmoryScreen
        inventory={mockInventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    await waitFor(() => {
      const positions = useGearStore.getState().boardPositions;
      expect(Object.keys(positions)).toEqual(["gear-helm"]);
    });
  });
});
