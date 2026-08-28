import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { AlchemistShopScreen } from "@/features/alchemy/run-loop/screens/alchemist-shop-screen";
import type { BattleCard } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installShopScreenIntersectionObserver } from "../../../../helpers/shop-screen-ui-mocks";

beforeAll(() => {
  installShopScreenIntersectionObserver();
});

vi.mock("@/features/alchemy/shared/ui/shop-card-item", () => import("../../../../helpers/shop-screen-ui-mocks"));
vi.mock("@/features/alchemy/shared/ui/selectable-card", () => import("../../../../helpers/shop-screen-ui-mocks"));
vi.mock("@/features/alchemy/shared/ui/card-selection-grid", () => import("../../../../helpers/shop-screen-ui-mocks"));
vi.mock(
  "@/features/alchemy/run-loop/screens/shop-browse-shell",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
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
  installDisabledAnimationsForTests();

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
        onOpenMenu={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Mix Potions/i }));
    expect(await screen.findByText("Select two Potions to Combine")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(await screen.findByRole("button", { name: /Mix Potions/i })).toBeTruthy();
    expect(screen.queryByText("Select two Potions to Combine")).toBeNull();
    expect(gameMenuHandler).not.toHaveBeenCalled();

    window.removeEventListener("keydown", gameMenuHandler);
  });
});
