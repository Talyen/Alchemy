import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { AlchemistShopScreen } from "@/features/alchemy/run-loop/screens/alchemist-shop-screen";
import { cardById } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installShopScreenIntersectionObserver } from "../../../../helpers/shop-screen-ui-mocks";

beforeAll(() => {
  installShopScreenIntersectionObserver();
});

vi.mock(
  "@/features/alchemy/run-loop/shop/ui/purchasable-shop-item",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => import("../../../../helpers/shop-screen-ui-mocks"));
vi.mock(
  "@/features/alchemy/shared/ui/cards/card-selection-grid",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
vi.mock(
  "@/features/alchemy/run-loop/screens/shop-browse-shell",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
const potion = cardById["health-potion"]!;

describe("AlchemistShopScreen mix Escape", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });

  it("opens Strengthen separately and respects eligibility, affordability, and shared use", async () => {
    const user = userEvent.setup();
    const onStrengthenPotion = vi.fn(() => null);
    const onMixPotions = vi.fn(() => null);
    const props = {
      gold: 25,
      runDeck: [cardById["health-potion"]!],
      potionCards: [],
      refreshesLeft: 0,
      mixUsed: false,
      purchasedSlotKeys: [],
      getPotionPrice: () => 10,
      mixPrice: 25,
      refreshPrice: 15,
      onBuyCard: () => true,
      onRefresh: () => {},
      onMixPotions,
      onStrengthenPotion,
      potency: 0,
      onContinue: () => {},
    };
    const { rerender } = render(<AlchemistShopScreen {...props} />);
    expect((screen.getByRole("button", { name: /^Mix Potion/ }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /^Distill/ }));
    expect(await screen.findByRole("heading", { name: "Select a Potion to Distill" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Mix/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Select shop card" }));
    await user.click(screen.getByRole("button", { name: "Distill · 25 Gold" }));
    expect(onStrengthenPotion).toHaveBeenCalledExactlyOnceWith(0);
    expect(onMixPotions).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    rerender(<AlchemistShopScreen {...props} gold={24} />);
    expect(((await screen.findByRole("button", { name: /^Distill/ })) as HTMLButtonElement).disabled).toBe(true);
    rerender(<AlchemistShopScreen {...props} mixUsed />);
    expect((screen.getByRole("button", { name: "Mix Potion - Used" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Distill - Used" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("requires two distinct ingredients after deselecting the first potion", async () => {
    const user = userEvent.setup();
    const onMixPotions = vi.fn(() => null);

    render(
      <AlchemistShopScreen
        gold={100}
        runDeck={[potion, cardById["mana-potion"]!]}
        potionCards={[potion]}
        refreshesLeft={1}
        mixUsed={false}
        purchasedSlotKeys={[]}
        getPotionPrice={() => 10}
        mixPrice={25}
        refreshPrice={15}
        onBuyCard={() => true}
        onRefresh={() => true}
        onMixPotions={onMixPotions}
        onStrengthenPotion={() => null}
        potency={0}
        onContinue={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Mix Potion/ }));
    const [first, second] = await screen.findAllByRole("button", { name: "Select shop card" });
    const combine = screen.getByRole("button", { name: /^Mix(?: ·.*)?$/ });
    await user.click(first!);
    await user.click(second!);
    await user.click(first!);
    await user.click(second!);
    expect((combine as HTMLButtonElement).disabled).toBe(true);
    await user.click(combine);
    expect(onMixPotions).not.toHaveBeenCalled();

    await user.click(second!);
    await user.click(first!);
    await user.click(combine);
    expect(onMixPotions).toHaveBeenCalledExactlyOnceWith(1, 0);
  });

  it("shows a brewed result only after saving and discards it when the player leaves the panel", async () => {
    const user = userEvent.setup();
    const pending: Array<() => void> = [];
    const onStrengthenPotion = vi.fn(() => potion);
    render(
      <AlchemistShopScreen
        gold={100}
        runDeck={[potion]}
        potionCards={[]}
        refreshesLeft={0}
        mixUsed={false}
        purchasedSlotKeys={[]}
        getPotionPrice={() => 10}
        mixPrice={25}
        refreshPrice={15}
        onBuyCard={() => true}
        onRefresh={() => {}}
        onMixPotions={() => null}
        onStrengthenPotion={onStrengthenPotion}
        potency={0}
        onContinue={() => {}}
        afterProgressSaved={(run) => pending.push(run)}
      />,
    );
    const brew = async () => {
      await user.click(screen.getByRole("button", { name: /^Distill/ }));
      await user.click(await screen.findByRole("button", { name: "Select shop card" }));
      await user.click(screen.getByRole("button", { name: "Distill · 25 Gold" }));
    };
    await brew();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    act(() => pending.shift()!());
    expect(await screen.findByRole("button", { name: "Original: Health Potion" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspect brew result: Health Potion" })).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    await brew();
    await user.keyboard("{Escape}");
    act(() => pending.shift()!());
    expect(await screen.findByRole("button", { name: /^Distill/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(onStrengthenPotion).toHaveBeenCalledTimes(2);
  });

  it("cancels mix mode on Escape and stops GameMenu from receiving the key", async () => {
    const user = userEvent.setup();
    const gameMenuHandler = vi.fn();
    window.addEventListener("keydown", gameMenuHandler);

    render(
      <AlchemistShopScreen
        gold={100}
        runDeck={[potion, cardById["mana-potion"]!]}
        potionCards={[potion]}
        refreshesLeft={1}
        mixUsed={false}
        purchasedSlotKeys={[]}
        getPotionPrice={() => 10}
        mixPrice={25}
        refreshPrice={15}
        onBuyCard={() => true}
        onRefresh={() => true}
        onMixPotions={() => null}
        onStrengthenPotion={() => null}
        potency={0}
        onContinue={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Mix Potion/ }));
    expect(await screen.findByRole("heading", { name: "Mix Potion" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Distill/ })).toBeNull();

    await user.keyboard("{Escape}");

    expect(await screen.findByRole("button", { name: /^Mix Potion/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Mix Potion" })).toBeNull();
    expect(gameMenuHandler).not.toHaveBeenCalled();

    window.removeEventListener("keydown", gameMenuHandler);
  });
});
