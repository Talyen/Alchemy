// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArmoryScreen } from "@/features/alchemy/meta/screens/armory-screen";
import { createEmptyGearLoadouts, CRAFTING_CURRENCY_LIST } from "@/lib/gear";
import type { GearInstance } from "@/lib/gear";
import type { CharacterId } from "@/lib/game-data";
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
    expect(screen.getByText("Leather Helm").className).toContain("text-stone-100");
    expect(screen.getByText("Salvaging items yields crafting materials").isConnected).toBe(true);

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

  it("does not dismiss salvage confirmation when clicking the backdrop", async () => {
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
    await user.click(screen.getByRole("button", { name: /Salvage .*Leather Helm/ }));

    expect(screen.getByText("Salvaging items yields crafting materials").isConnected).toBe(true);
    await user.click(document.querySelector(".motion-overlay")!);
    expect(screen.getByText("Salvaging items yields crafting materials").isConnected).toBe(true);
  });

  it("opens salvage confirmation when clicking the inventory tile wrapper", async () => {
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
    const tile = document.querySelector('[data-testid="armory-inventory-item"][data-gear-title="Leather Helm"]')!;
    await user.click(tile);
    expect(screen.getByText("Salvaging items yields crafting materials").isConnected).toBe(true);
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

  it("renders crafting currency stacks and applies the active currency to gear", async () => {
    const user = userEvent.setup();
    const onApplyCurrency = vi.fn(() => true);
    render(
      <ArmoryScreen
        inventory={[{ instanceId: "gear-helm", definitionId: "leather-helm-basic", affixes: [{ id: "max-health", value: 7 }] }]}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
        craftingCurrencies={{
          "discordant-dice": 0,
          "sprig-of-growth": 0,
          voidstone: 1,
          "ascension-seal": 0,
          "severance-maw": 0,
          "smiths-whetstone": 0,
        }}
        onApplyCurrency={onApplyCurrency}
      />,
    );

    const currency = screen.getByLabelText("Use Voidstone");
    fireEvent.contextMenu(currency);
    await user.click(screen.getByRole("button", { name: /Apply Voidstone/ }));

    expect(onApplyCurrency).toHaveBeenCalledWith("voidstone", "gear-helm");
    expect(screen.queryByRole("button", { name: /Apply Voidstone/ })).toBeNull();
  });

  it("portals crafting currency tooltips to document.body with shared tooltip styling", () => {
    render(
      <ArmoryScreen
        inventory={[{ instanceId: "gear-helm", definitionId: "leather-helm-basic", affixes: [{ id: "max-health", value: 7 }] }]}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
        craftingCurrencies={{
          "discordant-dice": 0,
          "sprig-of-growth": 0,
          voidstone: 1,
          "ascension-seal": 0,
          "severance-maw": 0,
          "smiths-whetstone": 0,
        }}
        onApplyCurrency={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(screen.getByLabelText("Use Voidstone"));
    expect(screen.getByText("Voidstone")).toBeTruthy();
    const tooltip = screen.getByText("Remove All Affixes");
    expect(tooltip.isConnected).toBe(true);
    expect(tooltip.closest(".armory-inventory-tooltip")?.parentElement).toBe(document.body);
    expect(tooltip.parentElement?.className).toContain("text-sm");
  });

  it("clears active currency targeting when that currency reaches zero", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ArmoryScreen
        inventory={[{ instanceId: "gear-helm", definitionId: "leather-helm-basic", affixes: [{ id: "max-health", value: 7 }] }]}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
        craftingCurrencies={{
          "discordant-dice": 0,
          "sprig-of-growth": 0,
          voidstone: 1,
          "ascension-seal": 0,
          "severance-maw": 0,
          "smiths-whetstone": 0,
        }}
        onApplyCurrency={vi.fn(() => true)}
      />,
    );

    fireEvent.contextMenu(screen.getByLabelText("Use Voidstone"));
    expect(screen.getByRole("button", { name: /Apply Voidstone/ }).isConnected).toBe(true);

    rerender(
      <ArmoryScreen
        inventory={[{ instanceId: "gear-helm", definitionId: "leather-helm-basic", affixes: [{ id: "max-health", value: 7 }] }]}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
        craftingCurrencies={{
          "discordant-dice": 0,
          "sprig-of-growth": 0,
          voidstone: 0,
          "ascension-seal": 0,
          "severance-maw": 0,
          "smiths-whetstone": 0,
        }}
        onApplyCurrency={vi.fn(() => true)}
      />,
    );

    await user.keyboard("{Tab}");
    expect(screen.queryByRole("button", { name: /Apply Voidstone/ })).toBeNull();
  });

  it("clears salvage and currency targeting when browse-only mode becomes active", async () => {
    const user = userEvent.setup();
    const onSalvage = vi.fn();
    const onApplyCurrency = vi.fn(() => true);
    const props = {
      inventory: [{ instanceId: "gear-helm", definitionId: "leather-helm-basic", affixes: [{ id: "max-health", value: 7 }] }] as GearInstance[],
      loadouts: createEmptyGearLoadouts(),
      finishedRunCharacters: ["knight"] as CharacterId[],
      onOpenMenu: vi.fn(),
      onEquip: vi.fn(),
      onUnequip: vi.fn(),
      onSalvage,
      craftingCurrencies: {
        "discordant-dice": 0,
        "sprig-of-growth": 0,
        voidstone: 1,
        "ascension-seal": 0,
        "severance-maw": 0,
        "smiths-whetstone": 0,
      },
      onApplyCurrency,
    };

    const { rerender } = render(<ArmoryScreen {...props} browseOnly={false} />);

    await user.click(screen.getByLabelText("Salvage Gear"));
    await user.click(screen.getByRole("button", { name: /Salvage .*Leather Helm/ }));
    expect(screen.getByText("Salvaging items yields crafting materials").isConnected).toBe(true);

    rerender(<ArmoryScreen {...props} browseOnly={true} />);
    await waitFor(() => {
      expect(screen.queryByText("Salvaging items yields crafting materials")).toBeNull();
    });
    expect(screen.getByLabelText("Salvage Gear")).toHaveProperty("disabled", true);

    rerender(<ArmoryScreen {...props} browseOnly={false} />);
    fireEvent.contextMenu(screen.getByLabelText("Use Voidstone"));
    expect(screen.getByRole("button", { name: /Apply Voidstone/ }).isConnected).toBe(true);

    rerender(<ArmoryScreen {...props} browseOnly={true} />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Apply Voidstone/ })).toBeNull();
    });

    expect(onSalvage).not.toHaveBeenCalled();
    expect(onApplyCurrency).not.toHaveBeenCalled();
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

  it.each(CRAFTING_CURRENCY_LIST)("enters apply mode for $displayName", ({ id, displayName }) => {
    const inventory: GearInstance[] = [
      { instanceId: "gear-helm", definitionId: "leather-helm-basic", affixes: [{ id: "max-health", value: 7 }] },
    ];
    render(
      <ArmoryScreen
        inventory={inventory}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
        craftingCurrencies={{
          "discordant-dice": 0,
          "sprig-of-growth": 0,
          voidstone: 0,
          "ascension-seal": 0,
          "severance-maw": 0,
          "smiths-whetstone": 0,
          [id]: 1,
        }}
        onApplyCurrency={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByLabelText(`Use ${displayName}`));
    expect(
      screen.getByRole("button", { name: (name) => name.includes(`Apply ${displayName}`) }),
    ).toBeTruthy();
  });

  it("renders both affix epithets in the gear tooltip portal", () => {
    render(
      <ArmoryScreen
        inventory={[
          {
            instanceId: "gear-sword",
            definitionId: "shortsword-basic",
            affixes: [
              { id: "flat-physical", value: 1 },
              { id: "flat-burn", value: 1 },
            ],
          },
        ]}
        loadouts={createEmptyGearLoadouts()}
        finishedRunCharacters={["knight"]}
        browseOnly={false}
        onOpenMenu={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onSalvage={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(document.querySelector('[data-gear-title="Shortsword"]')!);
    expect(screen.getByText("Ironbound")).toBeTruthy();
    expect(screen.getByText("Blazing")).toBeTruthy();
    expect(screen.getByText("Ironbound").closest(".armory-inventory-tooltip")?.parentElement).toBe(document.body);
  });
});
