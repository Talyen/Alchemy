import "../../../../helpers/mock-audio";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { playUISound } from "@/lib/audio";
import { createEmptyGearLoadouts } from "@/lib/gear";
import { ArmoryScreen } from "@/features/alchemy/meta/screens/armory-screen";
import { COMBAT_LOCKED_MESSAGE } from "@/features/alchemy/meta/screens/armory/armory-item-state";
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
    expect(screen.getByRole("heading", { name: "Weapons" })).toBeTruthy();
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

  it("displays character name chip with matching tab color when item is equipped on another character", () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.rogue["main-hand"] = "gear-sword";
    renderArmoryScreen({ loadouts });

    const swordItem = document.querySelector('[data-testid="armory-inventory-item"][data-gear-title="Longsword"]');
    expect(swordItem).not.toBeNull();
    const chip = swordItem?.querySelector("span");
    expect(chip).not.toBeNull();
    expect(chip?.className).toMatch(/text-red-600/);
  });

  it("switches to an unlocked character", async () => {
    const user = userEvent.setup();
    renderArmoryScreen({ finishedRunCharacters: ["knight", "rogue"] });

    await user.click(screen.getByRole("button", { name: "Rogue" }));

    expect(screen.getByRole("button", { name: "Rogue" }).className).toMatch(/ring-/);
  });

  it("renders character tabs in roster order", () => {
    renderArmoryScreen({
      finishedRunCharacters: ["knight", "rogue", "ranger", "wizard", "alchemist", "warlock", "druid"],
    });

    expect(
      within(screen.getByTestId("armory-character-selector"))
        .getAllByRole("button")
        .map((button) => button.textContent?.trim()),
    ).toEqual(["Knight", "Rogue", "Ranger", "Wizard", "Alchemist", "Warlock", "Druid", "Wildcard"]);
  });

  it("disables characters whose prerequisite has not finished", () => {
    renderArmoryScreen({ finishedRunCharacters: ["knight"] });

    expect(screen.getByRole("button", { name: "Rogue" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Wizard (Locked)" })).toHaveProperty("disabled", true);
  });

  it("stays silent while browsing a hero in Combat and errors on a locked change", async () => {
    const user = userEvent.setup();
    const onUnequip = vi.fn();
    const onEquipTrinket = vi.fn();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = "gear-sword";
    renderArmoryScreen({
      combatRestrictions: { characters: { knight: ["campaign"] }, gear: {}, trinkets: {} },
      loadouts,
      onUnequip,
      onEquipTrinket,
      ownedTrinketIds: ["brass-censer"],
    });

    expect(screen.queryByText(COMBAT_LOCKED_MESSAGE)).toBeNull();

    await user.click(screen.getByLabelText("Trinket equipment slot"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onUnequip).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Equip Brass Censer" }));
    expect(onEquipTrinket).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
    expect(screen.getByRole("alert").textContent).toBe(COMBAT_LOCKED_MESSAGE);
  });

  it("errors when trying to unequip gear for a hero in Combat", async () => {
    const user = userEvent.setup();
    const onUnequip = vi.fn();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = "gear-sword";
    renderArmoryScreen({
      combatRestrictions: { characters: { knight: ["campaign"] }, gear: {}, trinkets: {} },
      loadouts,
      onUnequip,
    });

    expect(screen.queryByRole("alert")).toBeNull();

    await user.click(screen.getByLabelText("Main-hand equipment slot"));
    expect(onUnequip).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
    expect(screen.getByRole("alert").textContent).toBe(COMBAT_LOCKED_MESSAGE);
  });

  it("reserves another hero’s equipment while leaving unused gear editable", async () => {
    const user = userEvent.setup();
    const onEquip = vi.fn();
    const loadouts = createEmptyGearLoadouts();
    loadouts.rogue["main-hand"] = "gear-sword";
    renderArmoryScreen({
      loadouts,
      onEquip,
      combatRestrictions: { characters: { rogue: ["labyrinth"] }, gear: { "gear-sword": "rogue" }, trinkets: {} },
    });
    const sword = screen.getByRole("button", { name: /Longsword. Reserved for Rogue/ });
    expect(sword.getAttribute("aria-disabled")).toBe("true");
    await user.click(sword);
    expect(onEquip).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText("Armor equipment slot"));
    await user.click(await screen.findByRole("button", { name: "Leather Armor" }));
    expect(onEquip).toHaveBeenCalledWith("knight", "body", expect.objectContaining({ instanceId: "gear-body" }));
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

  it("keeps a 2×3 inventory footprint when the selected slot has no items", async () => {
    const user = userEvent.setup();
    renderArmoryScreen();

    await user.click(screen.getByLabelText("Right accessory equipment slot"));
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Empty" })).toBeTruthy();
      expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(0);
      expect(document.querySelectorAll('[data-testid="armory-inventory-filler"]')).toHaveLength(6);
    });
  });
});

describe("ArmoryScreen equipment movement and inventory ordering", () => {
  installArmoryScreenTestHooks();

  it("renders the Sort control with Rarity and Name for gear", () => {
    renderArmoryScreen();
    expect(screen.getByRole("combobox", { name: "Sort inventory" })).toBeTruthy();
  });

  it("sorts inventory on demand and resets to page 0", async () => {
    const user = userEvent.setup();
    const items = [
      ...Array.from({ length: 7 }, (_, i) => ({
        instanceId: `sword-basic-${i}`,
        definitionId: "longsword-basic" as const,
        affixes: [],
      })),
      {
        instanceId: "hatchet-basic-1",
        definitionId: "hatchet-basic" as const,
        affixes: [],
      },
    ];
    renderArmoryScreen({ inventories: createArmoryInventories(items) });

    // Move to page 1
    await user.click(screen.getByLabelText("Next page"));
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(2);
    });

    // Click sort
    await user.click(screen.getByRole("combobox", { name: "Sort inventory" }));
    const nameOption = await screen.findByRole("option", { name: "Name" });
    await user.click(nameOption);

    // Resets to page 0
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(6);
      expect(
        document.querySelectorAll('[data-testid="armory-inventory-item"]')[0]?.getAttribute("data-gear-title"),
      ).toBe("Hatchet");
    });
  });

  it("preserves working order and page when switching categories", async () => {
    const user = userEvent.setup();
    const swords = Array.from({ length: 8 }, (_, i) => ({
      instanceId: `sword-${i}`,
      definitionId: "longsword-basic" as const,
      affixes: [],
    }));
    const armor = Array.from({ length: 8 }, (_, i) => ({
      instanceId: `armor-${i}`,
      definitionId: "leather-armor-basic" as const,
      affixes: [],
    }));
    renderArmoryScreen({ inventories: createArmoryInventories([...swords, ...armor]) });

    // Currently on main-hand (swords). Advance to page 1.
    await user.click(screen.getByLabelText("Next page"));
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(2);
    });

    // Switch to body slot
    await user.click(screen.getByLabelText("Armor equipment slot"));
    await waitFor(() => {
      // Body slot starts on page 0 with 6 items
      expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(6);
    });

    // Switch back to main-hand slot
    await user.click(screen.getByLabelText("Main-hand equipment slot"));
    await waitFor(() => {
      // Remembered page 1 (2 items)
      expect(document.querySelectorAll('[data-testid="armory-inventory-item"]')).toHaveLength(2);
    });
  });

  it("equips into an empty slot and compacts inventory", async () => {
    const user = userEvent.setup();
    const onEquip = vi.fn(() => true);
    const sword = { instanceId: "sword-1", definitionId: "longsword-basic" as const, affixes: [] };
    const hatchet = { instanceId: "hatchet-1", definitionId: "hatchet-basic" as const, affixes: [] };
    const loadouts = createEmptyGearLoadouts();

    renderArmoryScreen({
      onEquip,
      loadouts,
      inventories: createArmoryInventories([sword, hatchet]),
    });

    const swordButton = screen.getByRole("button", { name: "Longsword" });
    await user.click(swordButton);

    expect(onEquip).toHaveBeenCalledWith("knight", "main-hand", expect.objectContaining({ instanceId: "sword-1" }));
  });

  it("unequips into the first position of the current page", async () => {
    const user = userEvent.setup();
    const onUnequip = vi.fn();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = "sword-equipped";
    const sword = { instanceId: "sword-equipped", definitionId: "longsword-basic" as const, affixes: [] };
    const hatchet = { instanceId: "hatchet-1", definitionId: "hatchet-basic" as const, affixes: [] };

    renderArmoryScreen({
      onUnequip,
      loadouts,
      inventories: createArmoryInventories([sword, hatchet]),
    });

    const slotBtn = screen.getByLabelText("Main-hand equipment slot");
    await user.click(slotBtn);

    expect(onUnequip).toHaveBeenCalledWith("knight", "main-hand");
  });

  it("replaces equipped item and preserves working position", async () => {
    const user = userEvent.setup();
    const onEquip = vi.fn(() => true);
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = "sword-1";
    const sword1 = { instanceId: "sword-1", definitionId: "longsword-basic" as const, affixes: [] };
    const sword2 = { instanceId: "sword-2", definitionId: "longsword-basic" as const, affixes: [] };
    const hatchet = { instanceId: "hatchet-1", definitionId: "hatchet-basic" as const, affixes: [] };

    const { rerender, props } = renderArmoryScreen({
      onEquip,
      loadouts,
      inventories: createArmoryInventories([sword1, hatchet, sword2]),
    });

    const swordButton = screen.getByRole("button", { name: "Longsword" });
    await user.click(swordButton);

    expect(onEquip).toHaveBeenCalledWith("knight", "main-hand", expect.objectContaining({ instanceId: "sword-2" }));

    // When authoritative loadout reflects sword-2 equipped and sword-1 in inventory
    const newLoadouts = {
      ...loadouts,
      knight: { ...loadouts.knight, "main-hand": "sword-2" },
    };
    rerender(
      <ArmoryScreen
        {...props}
        loadouts={newLoadouts}
        inventories={createArmoryInventories([sword1, hatchet, sword2])}
      />,
    );

    const items = document.querySelectorAll('[data-testid="armory-inventory-item"]');
    expect(items).toHaveLength(2);
    // sword-1 takes the position previously held by sword-2
    expect(items[0]?.getAttribute("data-instance-id")).toBe("hatchet-1");
    expect(items[1]?.getAttribute("data-instance-id")).toBe("sword-1");
  });

  it("equips and unequips trinkets following inventory ordering rules", async () => {
    const user = userEvent.setup();
    const onEquipTrinket = vi.fn();
    const onUnequipTrinket = vi.fn();

    const { rerender, props } = renderArmoryScreen({
      onEquipTrinket,
      onUnequipTrinket,
      ownedTrinketIds: ["brass-censer", "bone-charm"],
    });

    // Select trinket slot
    await user.click(screen.getByLabelText("Trinket equipment slot"));

    // Verify sort option is present
    expect(screen.getByRole("combobox", { name: "Sort inventory" })).toBeDefined();

    // Click trinket to equip
    const censerBtn = screen.getByRole("button", { name: "Equip Brass Censer" });
    await user.click(censerBtn);

    expect(onEquipTrinket).toHaveBeenCalledWith("knight", "brass-censer");

    // Rerender with trinket equipped
    rerender(
      <ArmoryScreen
        {...props}
        equippedTrinkets={{ ...props.equippedTrinkets, knight: "brass-censer" }}
        ownedTrinketIds={["brass-censer", "bone-charm"]}
      />,
    );

    // Click trinket slot to unequip
    const trinketSlot = screen.getByLabelText("Trinket equipment slot");
    await user.click(trinketSlot);

    expect(onUnequipTrinket).toHaveBeenCalledWith("knight");
  });

  it("equipping a two-handed weapon handles off-hand conflict", async () => {
    const user = userEvent.setup();
    const onEquip = vi.fn(() => true);
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = "sword-1";
    loadouts.knight["off-hand"] = "shield-1";
    const sword1 = { instanceId: "sword-1", definitionId: "longsword-basic" as const, affixes: [] };
    const shield1 = { instanceId: "shield-1", definitionId: "kite-shield-basic" as const, affixes: [] };
    const staff1 = { instanceId: "staff-1", definitionId: "staff-basic" as const, affixes: [] };

    renderArmoryScreen({
      onEquip,
      loadouts,
      inventories: createArmoryInventories([sword1, shield1, staff1]),
    });

    const staffBtn = screen.getByRole("button", { name: "Staff" });
    await user.click(staffBtn);

    expect(onEquip).toHaveBeenCalledWith("knight", "main-hand", expect.objectContaining({ instanceId: "staff-1" }));
  });
});
