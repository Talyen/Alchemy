// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { AlchemistShopScreen } from "@/features/alchemy/run-loop/screens/alchemist-shop-screen";
import type { BattleCard } from "@/lib/game-data";
import type { ReactNode } from "react";

beforeAll(() => {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

vi.mock("@/features/alchemy/shared/ui/shop-card-item", () => ({
  PurchasableCardItem: () => <div>Potion offer</div>,
  SelectableShopCard: ({ onSelect }: { onSelect: () => void }) => (
    <button type="button" onClick={onSelect}>
      Select potion
    </button>
  ),
}));

vi.mock("@/features/alchemy/shared/ui/card-selection-grid", () => ({
  CardSelectionGrid: ({
    items,
    renderItem,
  }: {
    items: Array<{ card: BattleCard; index: number }>;
    renderItem: (item: { card: BattleCard; index: number }) => ReactNode;
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.index}>{renderItem(item)}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/features/alchemy/run-loop/screens/shop-browse-shell", () => ({
  ShopBrowseShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  RefreshShopServiceButton: ({ label = "Refresh" }: { label?: string }) => <button type="button">{label}</button>,
  ShopBrowseOfferings: ({ children, services }: { children: ReactNode; services: ReactNode }) => (
    <div>
      {services}
      {children}
    </div>
  ),
}));

vi.mock("@/features/alchemy/shared/ui/shared-ui", async () => {
  const actual = await vi.importActual<typeof import("@/features/alchemy/shared/ui/shared-ui")>(
    "@/features/alchemy/shared/ui/shared-ui",
  );
  return {
    ...actual,
    StaggerGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    StaggerItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock("@/lib/game-data/cards/card-pools", () => ({
  isStandardPotionCard: () => true,
}));

const potion = {
  id: "potion-1",
  title: "Potion One",
  descriptionLines: ["A potion."],
  art: "potion",
  cost: 0,
  effects: [],
} as BattleCard;

describe("AlchemistShopScreen mix Escape", () => {
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });

  it("cancels mix mode on Escape and stops GameMenu from receiving the key", async () => {
    const user = userEvent.setup();
    const gameMenuHandler = vi.fn();
    window.addEventListener("keydown", gameMenuHandler);

    render(
      <AlchemistShopScreen
        gold={100}
        runDeck={[potion, { ...potion, id: "potion-2", title: "Potion Two" }]}
        potionCards={[potion]}
        refreshesLeft={1}
        mixUsed={false}
        purchasedSlotKeys={[]}
        getPotionPrice={() => 10}
        mixPrice={25}
        refreshPrice={15}
        onBuyCard={() => true}
        onRefresh={() => {}}
        onMixPotions={() => null}
        onContinue={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Mix Potions/i }));
    expect(screen.getByText("Select two Potions to Combine")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Select two Potions to Combine")).toBeNull();
    expect(screen.getByRole("button", { name: /Mix Potions/i })).toBeTruthy();
    expect(gameMenuHandler).not.toHaveBeenCalled();

    window.removeEventListener("keydown", gameMenuHandler);
  });
});
