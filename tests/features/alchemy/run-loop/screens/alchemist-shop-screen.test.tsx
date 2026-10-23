import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { AlchemistShopScreen } from "@/features/alchemy/run-loop/screens/alchemist-shop-screen";
import { cardById } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installShopScreenIntersectionObserver } from "../../../../helpers/shop-screen-ui-mocks";

beforeAll(installShopScreenIntersectionObserver);
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
const props = () => ({
  gold: 100,
  runDeck: [potion, cardById["mana-potion"]!],
  items: [],
  brewOffers: [potion],
  brewUsed: false,
  mixUsed: false,
  distillUsed: false,
  refreshesLeft: 0,
  purchasedSlotKeys: [],
  getPrice: () => 10,
  mixPrice: 25,
  refreshPrice: 15,
  onBuy: () => true,
  onRefresh: () => {},
  onBrewPotion: vi.fn(() => null),
  onMixPotions: vi.fn(() => null),
  onStrengthenPotion: vi.fn(() => null),
  onContinue: () => {},
});
const click = (name: string) => fireEvent.click(screen.getAllByRole("button", { name, exact: true }).at(-1)!);
describe("Alchemist brewing navigation", () => {
  installDisabledAnimationsForTests();
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });
  it("keeps service availability independent and Back deselects before leaving Distill", () => {
    const p = props();
    const { rerender } = render(<AlchemistShopScreen {...p} mixUsed />);
    click("Potion Brewing");
    expect(screen.getByRole("button", { name: "Mix · Used" }).getAttribute("aria-disabled")).toBe("true");
    click("Distill");
    expect(screen.getByRole("heading", { name: "Distill Potion" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Select shop card" })[0]!);
    expect(screen.getByRole("button", { name: "Original: Health Potion" })).toBeTruthy();
    click("Back");
    expect(screen.getAllByRole("button", { name: "Select shop card" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Distill Potion" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("heading", { name: "Potion Brewing" })).toBeTruthy();
    rerender(<AlchemistShopScreen {...p} mixUsed distillUsed />);
    expect(screen.getByRole("button", { name: "Brew" }).getAttribute("aria-disabled")).not.toBe("true");
  });
  it("waits for persistence before showing Brew success", () => {
    const pending: Array<() => void> = [];
    const p = props();
    const onBrewPotion = vi.fn(() => potion);
    render(<AlchemistShopScreen {...p} onBrewPotion={onBrewPotion} afterProgressSaved={(run) => pending.push(run)} />);
    click("Potion Brewing");
    click("Brew");
    click("Select shop card");
    expect(onBrewPotion).not.toHaveBeenCalled();
    click("Brew · 25 Gold");
    expect(onBrewPotion).toHaveBeenCalledExactlyOnceWith(0);
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    act(() => pending.shift()!());
    click("Continue");
    expect(screen.getByRole("heading", { name: "Potion Brewing" })).toBeTruthy();
  });
  it("discards delayed success after leaving preparation", () => {
    const pending: Array<() => void> = [];
    render(
      <AlchemistShopScreen
        {...props()}
        onStrengthenPotion={() => potion}
        afterProgressSaved={(run) => pending.push(run)}
      />,
    );
    click("Potion Brewing");
    click("Distill");
    fireEvent.click(screen.getAllByRole("button", { name: "Select shop card" })[0]!);
    click("Distill · 25 Gold");
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => pending.shift()!());
    expect(screen.getByRole("heading", { name: "Potion Brewing" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });
});
