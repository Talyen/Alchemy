// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PurchasableCardItem } from "@/features/alchemy/shared/ui/shop-card-item";
import type { BattleCard } from "@/lib/game-data";

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

  it("shows the hover tooltip after purchase without interactive glow", () => {
    render(<PurchasableCardItem card={card} price={40} gold={80} purchased onBuy={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Strike" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.className).not.toMatch(/card-interactive-glow/);

    fireEvent.mouseEnter(button.parentElement!);

    const descriptionSpan = screen.getByText(/Deal/);
    expect(descriptionSpan.closest(".hover-popup-panel")).toBeTruthy();
  });
});
