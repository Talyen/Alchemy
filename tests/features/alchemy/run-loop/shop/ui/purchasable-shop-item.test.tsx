import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import {
  PurchasableCardItem,
  PurchasableGearItem,
  PurchasableTrinketItem,
} from "@/features/alchemy/run-loop/shop/ui/purchasable-shop-item";

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

describe("PurchasableCardItem", () => {
  afterEach(() => {
    cleanup();
  });

  it("lets keyboard users buy once and keep inspecting the purchased card", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    function ShopCardHarness() {
      const [purchased, setPurchased] = useState(false);
      return (
        <PurchasableCardItem
          card={card}
          price={40}
          gold={80}
          purchased={purchased}
          onBuy={() => {
            onBuy();
            setPurchased(true);
          }}
        />
      );
    }
    render(<ShopCardHarness />);
    const button = screen.getByRole("button", { name: "Buy Strike" });
    await user.tab();
    expect(document.activeElement).toBe(button);
    const descriptionSpan = screen.getByText(/Deal/);
    expect(descriptionSpan.closest(".hover-popup-panel")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(onBuy).toHaveBeenCalledTimes(1);
    const purchasedButton = screen.getByRole("button", { name: "Strike" });
    expect(document.activeElement).toBe(purchasedButton);
    expect(purchasedButton.getAttribute("aria-disabled")).toBe("true");
    expect(purchasedButton.className).not.toMatch(/card-interactive-glow/);
    expect(screen.getByText("Purchased")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(onBuy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Deal/).closest(".hover-popup-panel")).toBeTruthy();
  });
});

describe("PurchasableGearItem", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps unaffordable Gear keyboard-inspectable while preventing purchases", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    render(<PurchasableGearItem instance={testGearInstance} price={50} gold={20} purchased={false} onBuy={onBuy} />);
    const button = screen.getByRole("button", { name: /Buy Longsword/ });
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(onBuy).not.toHaveBeenCalled();
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

  it("keeps an unaffordable Trinket keyboard-inspectable while preventing purchases", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    render(<PurchasableTrinketItem trinket={testTrinket} price={50} gold={20} purchased={false} onBuy={onBuy} />);

    const button = screen.getByRole("button", { name: /Buy Meteorite/ });
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(await screen.findByRole("tooltip")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(onBuy).not.toHaveBeenCalled();
  });
});
