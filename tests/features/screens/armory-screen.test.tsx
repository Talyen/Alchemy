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
    { instanceId: "gear-helm", definitionId: "placeholder-helm", affixIds: [] },
    { instanceId: "gear-body", definitionId: "placeholder-body", affixIds: [] },
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
    expect(screen.getByRole("heading", { name: "Armory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Inventory" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Equipment" })).toBeTruthy();

    // Verify items in the inventory board are rendered via their dataset attributes
    expect(document.querySelector('[data-gear-title="Placeholder Helm"]')).toBeTruthy();
    expect(document.querySelector('[data-gear-title="Placeholder Body"]')).toBeTruthy();
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
    expect(screen.getByRole("heading", { name: "Knight" })).toBeTruthy();

    // Click on Rogue tab
    const rogueTab = screen.getByRole("button", { name: "Rogue" });
    await user.click(rogueTab);

    // Header updates to Rogue
    expect(screen.getByRole("heading", { name: "Rogue" })).toBeTruthy();
  });

  it("shows a confirmation dialog and triggers salvage when requested", async () => {
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

    // Click the helm item to trigger salvage
    const helmTile = screen.getByRole("button", { name: "Salvage Placeholder Helm" });
    await user.click(helmTile);

    // Verify confirmation modal elements are visible
    expect(screen.getByText("Salvage Gear?")).toBeTruthy();
    expect(screen.getByText(/Permanently salvage Placeholder Helm/)).toBeTruthy();

    // Confirm salvage
    const confirmBtn = screen.getByRole("button", { name: "Salvage" });
    await user.click(confirmBtn);

    expect(onSalvageMock).toHaveBeenCalledWith("gear-helm");
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

    expect(screen.getByText("Equipment can be changed after combat.")).toBeTruthy();
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

    expect(document.querySelector('[data-gear-title="Placeholder Helm"]')).toBeTruthy();
    expect(document.querySelector('[data-gear-title="Placeholder Body"]')).toBeNull();
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
      expect(positions["gear-helm"]).toBeDefined();
      expect(positions["stale-item-id"]).toBeUndefined();
    });
  });
});
