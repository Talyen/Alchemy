import "../../../../helpers/mock-audio";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { playUISound } from "@/lib/audio";
import { createEmptyGearLoadouts, EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import { ArmoryScreen } from "@/features/alchemy/meta/screens/armory-screen";
import { COMBAT_LOCKED_MESSAGE } from "@/features/alchemy/meta/screens/armory/armory-item-state";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";
import {
  createArmoryInventories,
  installArmoryScreenTestHooks,
  renderArmoryScreen,
} from "./armory/armory-screen-test-helpers";
import { installFocusInputForTests } from "../../../../helpers/focus-input-test";

installFocusInputForTests(true);

describe("ArmoryScreen core", () => {
  installArmoryScreenTestHooks();
  installReadyArtworkForTests();

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
    const onEquip = vi.fn(() => true);
    const onUnequip = vi.fn(() => true);
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = "gear-sword";
    renderArmoryScreen({ onEquip, onUnequip, loadouts });

    expect(document.querySelector('[data-testid="armory-inventory-item"][data-gear-title="Longsword"]')).toBeNull();

    await user.click(screen.getByLabelText("Main-hand equipment slot"));
    expect(onUnequip).toHaveBeenCalledWith("knight", "main-hand");
  });

  it("disables characters whose prerequisite has not finished", () => {
    renderArmoryScreen({ finishedRunCharacters: ["knight"] });

    expect(screen.getByRole("button", { name: "Rogue" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Wizard (Locked)" })).toHaveProperty("disabled", true);
  });

  it("keeps Combat browsing silent and rejects gear and trinket changes", async () => {
    const user = userEvent.setup();
    const onUnequip = vi.fn(() => true);
    const onEquipTrinket = vi.fn(() => true);
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
    await user.click(screen.getByLabelText("Main-hand equipment slot"));
    vi.mocked(playUISound).mockClear();
    await user.click(screen.getByLabelText("Main-hand equipment slot"));
    expect(onUnequip).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("error");
    expect(screen.getByRole("alert").textContent).toBe(COMBAT_LOCKED_MESSAGE);
  });

  it("reserves another hero’s equipment while leaving unused gear editable", async () => {
    const user = userEvent.setup();
    const onEquip = vi.fn(() => true);
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

  it("allows borrowing a combat hero's spare but protects it from crafting and salvage", async () => {
    const user = userEvent.setup();
    const spare = { instanceId: "combat-spare", definitionId: "longsword-basic", affixes: [] };
    const free = { ...spare, instanceId: "free-sword" };
    const inventories = createArmoryInventories([free]);
    inventories.rogue = [spare];
    const onEquip = vi.fn(() => false);
    const onApplyCurrency = vi.fn(() => true);
    const onSalvage = vi.fn(() => true);
    const onUnequip = vi.fn(() => true);
    const { props, rerender } = renderArmoryScreen({
      inventories,
      onEquip,
      onApplyCurrency,
      onSalvage,
      onUnequip,
      craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, "ascension-seal": 1 },
      combatRestrictions: { characters: { rogue: ["labyrinth"] }, gear: {}, trinkets: {} },
    });
    const button = (id: string) =>
      within(document.querySelector<HTMLElement>(`[data-instance-id="${id}"]`)!).getByRole("button");
    expect(button(spare.instanceId).getAttribute("aria-disabled")).toBe("false");
    await user.click(button(spare.instanceId));
    expect(onEquip).toHaveBeenCalledWith("knight", "main-hand", spare);

    await user.click(screen.getByRole("button", { name: /^Use Ascension Seal/ }));
    expect(button(spare.instanceId).getAttribute("aria-disabled")).toBe("true");
    expect(button(spare.instanceId).getAttribute("aria-label")).toContain("Reserved for Rogue");
    expect(button(free.instanceId).getAttribute("aria-disabled")).toBe("false");
    await user.click(button(spare.instanceId));
    expect(onApplyCurrency).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Salvage"));
    expect(button(spare.instanceId).getAttribute("aria-disabled")).toBe("true");
    await user.click(button(spare.instanceId));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onSalvage).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Salvage"));
    const borrowed = createEmptyGearLoadouts();
    borrowed.knight["main-hand"] = spare.instanceId;
    rerender(<ArmoryScreen {...props} loadouts={borrowed} />);
    const slot = screen.getByLabelText("Main-hand equipment slot");
    expect(slot.getAttribute("aria-disabled")).toBe("true");
    await user.click(slot);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Use Ascension Seal/ }));
    await user.click(slot);
    expect(onApplyCurrency).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(slot.hasAttribute("aria-disabled")).toBe(false);
    await user.click(slot);
    expect(onUnequip).toHaveBeenCalledWith("knight", "main-hand");
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
});

describe("ArmoryScreen equipment movement and inventory ordering", () => {
  installArmoryScreenTestHooks();
  installReadyArtworkForTests();

  // Sort-on-demand ordering and hero/category page memory live in
  // use-armory-ordering.test.ts (hook) and armory-ordering.test.ts (pure);
  // the screen keeps the equip/unequip wiring below.

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
    const onEquipTrinket = vi.fn(() => true);
    const onUnequipTrinket = vi.fn(() => true);

    const { rerender, props } = renderArmoryScreen({
      onEquipTrinket,
      onUnequipTrinket,
      ownedTrinketIds: ["brass-censer", "bone-charm"],
    });

    // Select trinket slot
    await user.click(screen.getByLabelText("Trinket equipment slot"));

    // Verify sort option is present
    expect(screen.getByRole("button", { name: "Sort inventory" })).toBeDefined();

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

  it("enters currency targeting mode, applies currency to gear, and clears on cancellation", async () => {
    const user = userEvent.setup();
    const onApplyCurrency = vi.fn(() => true);
    const affixedSword = {
      instanceId: "gear-sword",
      definitionId: "longsword-basic" as const,
      affixes: [{ id: "flat-physical" as const, value: 2 }],
    };

    const { rerender, props } = renderArmoryScreen({
      inventories: createArmoryInventories([affixedSword]),
      craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone: 1 },
      onApplyCurrency,
    });

    const voidstoneBtn = screen.getByLabelText(/^Use Voidstone,/);
    await user.click(voidstoneBtn);
    expect(voidstoneBtn.getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: /Apply Voidstone/ }));
    expect(onApplyCurrency).toHaveBeenCalledWith("voidstone", "gear-sword");

    // Clears targeting when count reaches zero
    rerender(<ArmoryScreen {...props} craftingCurrencies={{ ...EMPTY_CRAFTING_CURRENCIES, voidstone: 0 }} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Apply Voidstone/ })).toBeNull());
  });

  it("salvages an item after confirmation and exits on Escape", async () => {
    const user = userEvent.setup();
    const onSalvage = vi.fn(() => true);
    renderArmoryScreen({ onSalvage });

    await user.click(screen.getByLabelText("Salvage"));
    await user.click(screen.getByRole("button", { name: "Salvage Longsword" }));

    // Confirm dialog is shown
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/will yield:/)).toBeTruthy();

    // Escape dismisses dialog without salvaging
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onSalvage).not.toHaveBeenCalled();

    // Reopen and confirm salvage
    await user.click(screen.getByLabelText("Salvage"));
    await user.click(screen.getByRole("button", { name: "Salvage Longsword" }));
    await waitForArtwork();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Salvage$/ }));
    expect(onSalvage).toHaveBeenCalledWith("gear-sword");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows equipped gear and crafting currency descriptions on keyboard focus", async () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "gear-body";
    renderArmoryScreen({
      loadouts,
      craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone: 1 },
    });

    await waitForArtwork();
    act(() => screen.getByLabelText("Armor equipment slot").focus());
    await waitFor(() => {
      expect(screen.getByText("Leather Armor").closest(".armory-inventory-tooltip")).toBeTruthy();
    });

    act(() => screen.getByLabelText(/^Use Voidstone,/).focus());
    await waitFor(() => {
      const panel = document.querySelector(".hover-popup-panel[data-visible]");
      expect(panel?.textContent).toContain("Remove");
      expect(panel?.textContent).toContain("Affixes");
    });

    const salvageButton = screen.getByTestId("armory-salvage-toggle");
    expect(salvageButton.textContent).toBe("");
    act(() => salvageButton.focus());
    await waitFor(() => {
      const panel = document.querySelector(".hover-popup-panel[data-visible]");
      expect(panel?.textContent).toContain("Salvage");
      expect(panel?.textContent).toContain("Dismantle gear into crafting materials.");
      expect(panel?.textContent).not.toContain("and currencies");
      expect(panel?.textContent).not.toContain("No salvageable gear available");
    });
  });

  it("preserves inventory item elements when switching between compatible gear slots", async () => {
    const user = userEvent.setup();
    const sword = {
      instanceId: "gear-sword",
      definitionId: "longsword-basic" as const,
      affixes: [],
    };
    renderArmoryScreen({
      inventories: createArmoryInventories([sword]),
    });

    await waitForArtwork();
    const swordBtnBefore = screen.getByRole("button", { name: "Longsword" });

    // Switch to off-hand (both slots allow 1H swords)
    await user.click(screen.getByLabelText("Off-hand equipment slot"));
    await waitForArtwork();

    const swordBtnAfter = screen.getByRole("button", { name: "Longsword" });
    expect(swordBtnAfter).toBe(swordBtnBefore);
  });
});
