import "../../../../../helpers/mock-audio";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { createEmptyEquippedTrinkets, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";
import {
  createArmoryInventories,
  installArmoryScreenTestHooks,
  renderArmoryScreen,
} from "./armory-screen-test-helpers";

const ASTRAL_SWORD: GearInstance = {
  instanceId: "gear-astral-sword",
  definitionId: "longsword-astral",
  affixes: [{ id: "flat-burn", value: 2 }],
};

describe("Armory shine borders", () => {
  installArmoryScreenTestHooks();
  beforeEach(() => {
    useUiStore.setState({ hoveredCardId: null, shimmerState: null });
  });

  it("shows equipped gear shine only on hover, focus, or when its slot is selected", async () => {
    const user = userEvent.setup();
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = ASTRAL_SWORD.instanceId;
    renderArmoryScreen({ inventories: createArmoryInventories([ASTRAL_SWORD]), loadouts });

    const slot = screen.getByLabelText("Main-hand equipment slot");
    // Main-hand is the default selected slot, so its shine persists as a selection marker.
    expect(slot.querySelector(".shine-border")).not.toBeNull();
    expect(slot.className).toMatch(/has-shine-border/);

    // Selecting another slot hides the shine until hovered or focused.
    await user.click(screen.getByLabelText("Armor equipment slot"));
    expect(slot.querySelector(".shine-border")).toBeNull();
    expect(slot.className).not.toMatch(/has-shine-border/);
    expect(slot.className).toMatch(/border-border\/80/);

    fireEvent.mouseEnter(slot.parentElement!);
    expect(slot.querySelector(".shine-border")).not.toBeNull();
    expect(slot.className).toMatch(/card-art-shine/);
    fireEvent.mouseLeave(slot.parentElement!);
    expect(slot.querySelector(".shine-border")).toBeNull();

    fireEvent.focus(slot);
    expect(slot.querySelector(".shine-border")).not.toBeNull();
    fireEvent.blur(slot);
    expect(slot.querySelector(".shine-border")).toBeNull();
  });

  it("shows equipped trinket shine only on hover or when its slot is selected", async () => {
    const user = userEvent.setup();
    const equippedTrinkets = createEmptyEquippedTrinkets();
    equippedTrinkets.knight = "brass-censer";
    renderArmoryScreen({ ownedTrinketIds: ["brass-censer"], equippedTrinkets });

    const slot = screen.getByLabelText("Trinket equipment slot");
    // The default selected slot is main-hand, so the trinket slot starts without shine.
    expect(slot.querySelector(".shine-border")).toBeNull();

    fireEvent.mouseEnter(slot.parentElement!);
    expect(slot.querySelector(".shine-border")).not.toBeNull();
    fireEvent.mouseLeave(slot.parentElement!);
    expect(slot.querySelector(".shine-border")).toBeNull();

    await user.click(slot);
    expect(slot.querySelector(".shine-border")).not.toBeNull();
    expect(slot.className).toMatch(/has-shine-border/);
  });

  it("keeps inventory gear shine hover-only", () => {
    renderArmoryScreen({
      inventories: createArmoryInventories([
        { instanceId: "gear-basic", definitionId: "longsword-basic", affixes: [] },
        ASTRAL_SWORD,
      ]),
    });

    const tile = document.querySelector('[data-testid="armory-inventory-item"][data-gear-title="Astral Longsword"]');
    expect(tile).not.toBeNull();
    const button = tile!.querySelector("button")!;
    expect(button.querySelector(".shine-border")).toBeNull();

    fireEvent.mouseEnter(button.parentElement!);
    expect(button.querySelector(".shine-border")).not.toBeNull();
    expect(button.className).toMatch(/card-art-shine/);
    fireEvent.mouseLeave(button.parentElement!);
    expect(button.querySelector(".shine-border")).toBeNull();
  });
});
