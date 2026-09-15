import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EquipmentShopScreen } from "@/features/alchemy/run-loop/screens/equipment-shop-screen";
import type { GearInstance } from "@/lib/gear";
import { installReadyArtworkForTests } from "../../../../helpers/artwork-test";

const testGear: GearInstance = {
  instanceId: "iron-sword-1",
  definitionId: "longsword-basic",
  affixes: [],
};

describe("EquipmentShopScreen", () => {
  installReadyArtworkForTests();

  afterEach(() => {
    cleanup();
  });

  function renderEquipmentShop({
    gold = 100,
    gear = [testGear],
    refreshesLeft = 1,
    purchasedSlotKeys = [] as string[],
    getGearPrice = () => 60,
    refreshPrice = 15,
    onBuyGear = vi.fn(() => true),
    onRefresh = vi.fn(),
    onContinue = vi.fn(),
  } = {}) {
    return render(
      <EquipmentShopScreen
        gold={gold}
        gear={gear}
        refreshesLeft={refreshesLeft}
        purchasedSlotKeys={purchasedSlotKeys}
        getGearPrice={getGearPrice}
        refreshPrice={refreshPrice}
        onBuyGear={onBuyGear}
        onRefresh={onRefresh}
        onContinue={onContinue}
      />,
    );
  }

  it("renders screen title, gold, and purchasable gear", () => {
    renderEquipmentShop({ gold: 150 });

    expect(screen.getByRole("heading", { name: "Gear Shop" })).toBeTruthy();
    expect(screen.getByText("150")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Buy/i })).toBeTruthy();
  });

  it("calls onBuyGear with gear instance and its instanceId slot key when clicked", async () => {
    const user = userEvent.setup();
    const onBuyGear = vi.fn(() => true);
    renderEquipmentShop({ onBuyGear });

    const buyBtn = screen.getByRole("button", { name: /Buy/i });
    await user.click(buyBtn);

    expect(onBuyGear).toHaveBeenCalledWith(testGear, "iron-sword-1");
  });

  it("disables purchase when player cannot afford the price", () => {
    renderEquipmentShop({ gold: 20, getGearPrice: () => 60 });

    const buyBtn = screen.getByRole("button", { name: /Buy/i });
    expect(buyBtn).toHaveProperty("disabled", true);
  });

  it("marks gear as purchased when instanceId is in purchasedSlotKeys", () => {
    renderEquipmentShop({ purchasedSlotKeys: ["iron-sword-1"] });

    expect(screen.queryByRole("button", { name: /Buy/i })).toBeNull();
    const itemBtn = screen.getByRole("button", { name: "Longsword" });
    expect(itemBtn).toHaveProperty("disabled", true);
  });

  it("calls onRefresh when refresh button is clicked", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderEquipmentShop({ onRefresh });

    const refreshBtn = screen.getByRole("button", { name: /Refresh/i });
    await user.click(refreshBtn);

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("calls onContinue when Leave button is clicked", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    renderEquipmentShop({ onContinue });

    const leaveBtn = screen.getByRole("button", { name: "Leave" });
    await user.click(leaveBtn);

    expect(onContinue).toHaveBeenCalledOnce();
  });
});
