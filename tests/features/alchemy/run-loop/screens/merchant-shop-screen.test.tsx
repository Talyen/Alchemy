import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MerchantShopScreen } from "@/features/alchemy/run-loop/screens/merchant-shop-screen";
import type { BattleCard } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installShopScreenIntersectionObserver } from "../../../../helpers/shop-screen-ui-mocks";

beforeAll(() => {
  installShopScreenIntersectionObserver();
});

vi.mock("@/features/alchemy/shared/ui/purchasable-shop-item", () => import("../../../../helpers/shop-screen-ui-mocks"));
vi.mock("@/features/alchemy/shared/ui/selectable-card", () => import("../../../../helpers/shop-screen-ui-mocks"));
vi.mock("@/features/alchemy/shared/ui/card-selection-grid", () => import("../../../../helpers/shop-screen-ui-mocks"));
vi.mock(
  "@/features/alchemy/run-loop/screens/shop-browse-shell",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);

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
      />,
    );
  }

  it("stays in remove mode when removal fails", async () => {
    const user = userEvent.setup();
    const onRemoveCard = vi.fn(() => false);
    renderMerchant(onRemoveCard);

    await user.click(screen.getByRole("button", { name: /Remove Card/i }));
    expect(await screen.findByText("Select a card to remove from your deck")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Select shop card" }));
    await user.click(screen.getByRole("button", { name: /Remove Card/i }));

    expect(onRemoveCard).toHaveBeenCalledWith(0);
    expect(screen.getByText("Select a card to remove from your deck")).toBeTruthy();
  });

  it("returns to browse when removal succeeds", async () => {
    const user = userEvent.setup();
    renderMerchant(() => true);

    await user.click(screen.getByRole("button", { name: /Remove Card/i }));
    await user.click(screen.getByRole("button", { name: "Select shop card" }));
    await user.click(screen.getByRole("button", { name: /Remove Card/i }));

    expect(await screen.findByRole("button", { name: /Remove Card/i })).toBeTruthy();
    expect(screen.queryByText("Select a card to remove from your deck")).toBeNull();
  });
});
