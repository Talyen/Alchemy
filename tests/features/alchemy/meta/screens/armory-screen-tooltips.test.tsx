import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  createEmptyEquippedTrinkets,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
  generateUniqueGearInstance,
  getUniqueItemDefinition,
} from "@/lib/gear";
import {
  createArmoryInventories,
  installArmoryScreenTestHooks,
  renderArmoryScreen,
} from "./armory/armory-screen-test-helpers";

function tooltipPanelFor(text: string | RegExp) {
  const panel = screen.getByText(text).closest(".hover-popup-panel");
  expect(panel).toBeTruthy();
  return panel as HTMLElement;
}

function expectNoCategoryChip(panel: HTMLElement) {
  expect(within(panel).queryByText("Armory")).toBeNull();
  expect(within(panel).queryByText("Trinket")).toBeNull();
  expect(within(panel).queryByText("Unique")).toBeNull();
}

function expectGridTileWidth(element: HTMLElement) {
  expect(element.className).toMatch(/\bw-full\b/);
  expect(element.className).toMatch(/max-w-\[calc/);
  expect(element.className).not.toMatch(/(?:^|\s)w-\[calc/);
}

describe("ArmoryScreen tooltip integration", () => {
  installArmoryScreenTestHooks();

  it("portals crafting currency tooltips to document.body", async () => {
    renderArmoryScreen({ craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone: 1 } });

    fireEvent.mouseEnter(screen.getByLabelText("Use Voidstone"));

    const tooltipText = screen.getByText("Remove All Affixes");
    expect(tooltipText.closest(".armory-inventory-tooltip")).toBeTruthy();
    await waitFor(() => {
      expect(tooltipText.closest(".hover-popup-panel")?.getAttribute("data-visible")).toBe("true");
    });
    expect(document.body.contains(tooltipText)).toBe(true);
  });

  it("renders gear affix epithets in the portal", async () => {
    const user = userEvent.setup();
    renderArmoryScreen({
      inventories: createArmoryInventories([
        {
          instanceId: "gear-sword",
          definitionId: "shortsword-basic",
          affixes: [
            { id: "flat-physical", value: 1 },
            { id: "flat-burn", value: 1 },
          ],
        },
      ]),
    });

    await user.hover(screen.getByRole("button", { name: "Shortsword" }));

    expect(screen.getByText("Ironbound")).toBeTruthy();
    expect(screen.getByText("Blazing")).toBeTruthy();
  });

  it("portals equipped gear tooltips to document.body", async () => {
    const user = userEvent.setup();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "gear-body";
    renderArmoryScreen({ loadouts });

    await user.hover(screen.getByLabelText("Armor equipment slot"));

    await waitFor(() => {
      expect(screen.getByText("Leather Armor").closest(".armory-inventory-tooltip")).toBeTruthy();
    });
  });

  it("sizes trinket inventory tiles like gear and omits Armory tooltip chips", async () => {
    const user = userEvent.setup();
    renderArmoryScreen({ ownedTrinketIds: ["brass-censer"] });

    await user.click(screen.getByLabelText("Trinket equipment slot"));
    const trinketTile = screen.getByRole("button", { name: "Equip Brass Censer" });
    expectGridTileWidth(trinketTile);

    fireEvent.mouseEnter(trinketTile.parentElement!);
    await waitFor(() => {
      const panel = tooltipPanelFor(/doubled/);
      expect(within(panel).getByText("Brass Censer")).toBeTruthy();
      expectNoCategoryChip(panel);
    });
  });

  it("omits Armory chips from equipped trinket tooltips", async () => {
    const equippedTrinkets = createEmptyEquippedTrinkets();
    equippedTrinkets.knight = "brass-censer";
    renderArmoryScreen({ ownedTrinketIds: ["brass-censer"], equippedTrinkets });

    const slot = screen.getByLabelText("Trinket equipment slot");
    fireEvent.mouseEnter(slot.parentElement!);
    await waitFor(() => {
      const panel = tooltipPanelFor(/doubled/);
      expect(within(panel).getByText("Brass Censer")).toBeTruthy();
      expectNoCategoryChip(panel);
    });
  });

  it("sizes unique inventory tiles like basic gear and omits rarity chips", async () => {
    const user = userEvent.setup();
    const uniqueDef = getUniqueItemDefinition("wardbreaker");
    if (!uniqueDef) throw new Error("missing wardbreaker unique");
    const unique = generateUniqueGearInstance(uniqueDef);
    renderArmoryScreen({
      inventories: createArmoryInventories([
        { instanceId: "gear-sword", definitionId: "longsword-basic", affixes: [] },
        unique,
      ]),
    });

    const basicTile = screen.getByRole("button", { name: "Longsword" });
    const uniqueTile = screen.getByRole("button", { name: "Wardbreaker" });
    expectGridTileWidth(basicTile);
    expectGridTileWidth(uniqueTile);

    await user.hover(uniqueTile);

    const panel = tooltipPanelFor("Wardbreaking");
    expect(within(panel).getByText("Wardbreaker")).toBeTruthy();
    expectNoCategoryChip(panel);
  });
});
