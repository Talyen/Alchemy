import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrinketShopScreen } from "@/features/alchemy/run-loop/screens/trinket-shop-screen";
import type { TrinketEntry } from "@/lib/game-data";
import { shopItemSlotKey } from "@/features/alchemy/run-loop/shop/shop-slot-keys";
import { installReadyArtworkForTests } from "../../../../helpers/artwork-test";

const testTrinket: TrinketEntry = {
  id: "lucky-coin",
  title: "Lucky Coin",
  descriptionLines: ["Gain 5 gold."],
  art: "",
  effects: {},
};

describe("TrinketShopScreen", () => {
  installReadyArtworkForTests();

  afterEach(() => {
    cleanup();
  });

  function renderTrinketShop({
    gold = 100,
    trinkets = [testTrinket],
    refreshesLeft = 1,
    purchasedSlotKeys = [] as string[],
    getTrinketPrice = () => 50,
    refreshPrice = 15,
    onBuyTrinket = vi.fn(() => true),
    onRefresh = vi.fn(),
    onContinue = vi.fn(),
  } = {}) {
    return render(
      <TrinketShopScreen
        gold={gold}
        trinkets={trinkets}
        refreshesLeft={refreshesLeft}
        purchasedSlotKeys={purchasedSlotKeys}
        getTrinketPrice={getTrinketPrice}
        refreshPrice={refreshPrice}
        onBuyTrinket={onBuyTrinket}
        onRefresh={onRefresh}
        onContinue={onContinue}
      />,
    );
  }

  it("renders screen title, gold, and purchasable trinket", () => {
    renderTrinketShop({ gold: 120 });

    expect(screen.getByRole("heading", { name: "Trinket Shop" })).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buy Lucky Coin" })).toBeTruthy();
  });

  it("calls onBuyTrinket with trinket and slot key when clicked", async () => {
    const user = userEvent.setup();
    const onBuyTrinket = vi.fn(() => true);
    renderTrinketShop({ onBuyTrinket });

    const buyBtn = screen.getByRole("button", { name: "Buy Lucky Coin" });
    await user.click(buyBtn);

    expect(onBuyTrinket).toHaveBeenCalledWith(testTrinket, shopItemSlotKey("lucky-coin", 0));
  });

  it("disables purchase when gold is insufficient", () => {
    renderTrinketShop({ gold: 20, getTrinketPrice: () => 50 });

    const buyBtn = screen.getByRole("button", { name: "Buy Lucky Coin" });
    expect(buyBtn).toHaveProperty("disabled", true);
  });

  it("marks item as purchased when slotKey is in purchasedSlotKeys", () => {
    const slotKey = shopItemSlotKey("lucky-coin", 0);
    renderTrinketShop({ purchasedSlotKeys: [slotKey] });

    expect(screen.queryByRole("button", { name: "Buy Lucky Coin" })).toBeNull();
    const itemBtn = screen.getByRole("button", { name: "Lucky Coin" });
    expect(itemBtn).toHaveProperty("disabled", true);
  });

  it("calls onRefresh when refresh button is clicked", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderTrinketShop({ onRefresh });

    const refreshBtn = screen.getByRole("button", { name: /Refresh/i });
    await user.click(refreshBtn);

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("calls onContinue when Leave button is clicked", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    renderTrinketShop({ onContinue });

    const leaveBtn = screen.getByRole("button", { name: "Leave" });
    await user.click(leaveBtn);

    expect(onContinue).toHaveBeenCalledOnce();
  });
});
