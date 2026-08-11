// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEmptyGearLoadouts, EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import {
  createArmoryInventories,
  installArmoryScreenTestHooks,
  renderArmoryScreen,
} from "./armory/armory-screen-test-helpers";

describe("ArmoryScreen tooltip integration", () => {
  installArmoryScreenTestHooks();

  it("portals crafting currency tooltips to document.body", () => {
    renderArmoryScreen({ craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone: 1 } });

    fireEvent.mouseEnter(screen.getByLabelText("Use Voidstone"));

    const tooltipText = screen.getByText("Remove All Affixes");
    expect(tooltipText.closest(".armory-inventory-tooltip")?.parentElement).toBe(document.body);
  });

  it("renders gear affix epithets in the portal", () => {
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

    fireEvent.mouseEnter(document.querySelector('[data-gear-title="Shortsword"]')!);

    expect(screen.getByText("Ironbound")).toBeTruthy();
    expect(screen.getByText("Blazing")).toBeTruthy();
    expect(screen.getByText("Ironbound").closest(".armory-inventory-tooltip")?.parentElement).toBe(document.body);
  });

  it("portals equipped gear tooltips to document.body", async () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.helm = "gear-helm";
    renderArmoryScreen({ loadouts });

    fireEvent.mouseEnter(screen.getByLabelText("Helm equipment slot"));

    await waitFor(() => {
      expect(screen.getByText("Leather Helm").closest(".armory-inventory-tooltip")?.parentElement).toBe(document.body);
    });
  });
});
