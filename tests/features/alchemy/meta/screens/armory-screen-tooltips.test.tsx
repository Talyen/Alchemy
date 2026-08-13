// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(tooltipText.closest(".armory-inventory-tooltip")).toBeTruthy();
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
});
