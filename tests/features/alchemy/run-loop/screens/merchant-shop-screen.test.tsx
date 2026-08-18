// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MerchantShopScreen } from "@/features/alchemy/run-loop/screens/merchant-shop-screen";
import type { BattleCard } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

beforeAll(() => {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

vi.mock("@/features/alchemy/shared/ui/shop-card-item", () => ({
  PurchasableCardItem: () => <div>Shop offer</div>,
  SelectableShopCard: ({ onSelect }: { onSelect: () => void }) => (
    <button type="button" onClick={onSelect}>
      Select deck card
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

const deckCard = {
  id: "strike-1",
  title: "Strike",
  descriptionLines: ["Deal 6 damage."],
  art: "strike",
  cost: 1,
  effects: [],
} as BattleCard;

describe("MerchantShopScreen remove mode", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
  });

  function renderMerchant(onRemoveCard: (index: number) => boolean) {
    return render(
      <MerchantShopScreen
        gold={100}
        runDeck={[deckCard]}
        shopCards={[deckCard]}
        refreshesLeft={1}
        removeUsed={false}
        purchasedSlotKeys={[]}
        getCardPrice={() => 10}
        removePrice={25}
        refreshPrice={15}
        onBuyCard={() => true}
        onRemoveCard={onRemoveCard}
        onRefresh={() => {}}
        onContinue={() => {}}
        onOpenMenu={() => {}}
      />,
    );
  }

  it("stays in remove mode when removal fails", async () => {
    const user = userEvent.setup();
    const onRemoveCard = vi.fn(() => false);
    renderMerchant(onRemoveCard);

    await user.click(screen.getByRole("button", { name: /Remove Card/i }));
    expect(await screen.findByText("Select a card to remove from your deck")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Select deck card" }));
    await user.click(screen.getByRole("button", { name: /Remove Card/i }));

    expect(onRemoveCard).toHaveBeenCalledWith(0);
    expect(screen.getByText("Select a card to remove from your deck")).toBeTruthy();
  });

  it("returns to browse when removal succeeds", async () => {
    const user = userEvent.setup();
    renderMerchant(() => true);

    await user.click(screen.getByRole("button", { name: /Remove Card/i }));
    await user.click(screen.getByRole("button", { name: "Select deck card" }));
    await user.click(screen.getByRole("button", { name: /Remove Card/i }));

    expect(await screen.findByRole("button", { name: /Remove Card/i })).toBeTruthy();
    expect(screen.queryByText("Select a card to remove from your deck")).toBeNull();
  });
});
