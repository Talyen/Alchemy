import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import {
  PurchasableCardItem,
  PurchasableGearItem,
  PurchasableTrinketItem,
} from "@/features/alchemy/shared/ui/purchasable-shop-item";
import { getShopItemAriaLabel, getShopPurchaseState } from "@/features/alchemy/shared/ui/purchasable-shop-helpers";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";

const card = {
  id: "strike-1",
  title: "Strike",
  descriptionLines: ["Deal 6 damage."],
  art: "card-art-1",
  cost: 1,
  type: "attack",
  effects: [],
} as unknown as BattleCard;

const testTrinket: TrinketEntry = {
  id: "meteorite",
  title: "Meteorite",
  descriptionLines: ["Deal 2 damage at combat start."],
  art: "meteorite.png",
  effects: {},
};

const testGearInstance: GearInstance = {
  instanceId: "inst-1",
  definitionId: "longsword-basic",
  affixes: [],
};

describe("getShopPurchaseState", () => {
  it("returns canPurchase true when affordable and not yet purchased", () => {
    expect(getShopPurchaseState(50, 60, false)).toEqual({ canAfford: true, canPurchase: true });
    expect(getShopPurchaseState(50, 50, false)).toEqual({ canAfford: true, canPurchase: true });
  });

  it("returns canPurchase false when unaffordable or already purchased", () => {
    expect(getShopPurchaseState(50, 49, false)).toEqual({ canAfford: false, canPurchase: false });
    expect(getShopPurchaseState(50, 100, true)).toEqual({ canAfford: true, canPurchase: false });
  });
});

describe("getShopItemAriaLabel", () => {
  it("prepends Buy when not purchased, and uses title when purchased", () => {
    expect(getShopItemAriaLabel("Strike", false)).toBe("Buy Strike");
    expect(getShopItemAriaLabel("Strike", true)).toBe("Strike");
  });
});

describe("PurchasableCardItem", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the hover tooltip after purchase without interactive glow", () => {
    render(<PurchasableCardItem card={card} price={40} gold={80} purchased onBuy={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Strike" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.className).not.toMatch(/card-interactive-glow/);

    fireEvent.mouseEnter(button.parentElement!);

    const descriptionSpan = screen.getByText(/Deal/);
    expect(descriptionSpan.closest(".hover-popup-panel")).toBeTruthy();
  });

  it("removes the glow when a successful purchase marks the slot as purchased", () => {
    function ShopCardHarness() {
      const [purchased, setPurchased] = useState(false);
      return (
        <PurchasableCardItem card={card} price={40} gold={80} purchased={purchased} onBuy={() => setPurchased(true)} />
      );
    }

    render(<ShopCardHarness />);

    const availableButton = screen.getByRole("button", { name: "Buy Strike" });
    expect(availableButton.className).toMatch(/card-interactive-glow/);
    fireEvent.mouseEnter(availableButton.parentElement!);
    fireEvent.click(availableButton);

    const purchasedButton = screen.getByRole("button", { name: "Strike" });
    expect(purchasedButton).toHaveProperty("disabled", true);
    expect(purchasedButton.className).not.toMatch(/card-interactive-glow/);
  });
});

describe("PurchasableGearItem", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables purchase and triggers onBuy when clicked and affordable", () => {
    const onBuy = vi.fn();
    render(<PurchasableGearItem instance={testGearInstance} price={50} gold={100} purchased={false} onBuy={onBuy} />);

    const button = screen.getByRole("button", { name: /Buy Longsword/ });
    expect(button).not.toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(onBuy).toHaveBeenCalledTimes(1);
  });
});

describe("PurchasableTrinketItem", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables button when unaffordable", () => {
    const onBuy = vi.fn();
    render(<PurchasableTrinketItem trinket={testTrinket} price={50} gold={20} purchased={false} onBuy={onBuy} />);

    const button = screen.getByRole("button", { name: /Buy Meteorite/ });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(onBuy).not.toHaveBeenCalled();
  });
});
