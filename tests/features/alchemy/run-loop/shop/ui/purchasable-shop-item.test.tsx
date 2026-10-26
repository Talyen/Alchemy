import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { PurchasableCardItem } from "@/features/alchemy/run-loop/shop/ui/purchasable-shop-item";

import type { BattleCard } from "@/lib/game-data";
import { installFocusInputForTests } from "../../../../../helpers/focus-input-test";

installFocusInputForTests(true);

const card = {
  id: "strike-1",
  title: "Strike",
  descriptionLines: ["Deal 6 damage."],
  art: "card-art-1",
  cost: 1,
  type: "attack",
  effects: [],
} as unknown as BattleCard;

describe("PurchasableCardItem", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps an unaffordable card inspectable, then buys once when Gold becomes available", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    function ShopCardHarness({ gold }: { gold: number }) {
      const [purchased, setPurchased] = useState(false);
      return (
        <PurchasableCardItem
          card={card}
          price={40}
          gold={gold}
          purchased={purchased}
          onBuy={() => {
            onBuy();
            setPurchased(true);
          }}
        />
      );
    }
    const { rerender } = render(<ShopCardHarness gold={20} />);
    const button = screen.getByRole("button", { name: "Buy Strike for 40 Gold. Not enough Gold" });
    await user.tab();
    expect(document.activeElement).toBe(button);
    const descriptionSpan = screen.getByText(/Deal/);
    expect(descriptionSpan.closest(".hover-popup-panel")).toBeTruthy();
    await user.keyboard("{Enter}");
    await user.click(button);
    expect(onBuy).not.toHaveBeenCalled();
    rerender(<ShopCardHarness gold={80} />);
    expect(screen.getByRole("button", { name: "Buy Strike for 40 Gold" })).toBe(button);
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter}");
    expect(onBuy).toHaveBeenCalledTimes(1);
    const purchasedButton = screen.getByRole("button", { name: "Strike. Purchased" });
    expect(document.activeElement).toBe(purchasedButton);
    expect(purchasedButton.getAttribute("aria-disabled")).toBe("true");
    expect(purchasedButton.className).not.toMatch(/card-interactive-glow/);
    expect(screen.getByText("Purchased")).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(onBuy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Deal/).closest(".hover-popup-panel")).toBeTruthy();
  });
});
