import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GenericShopScreen } from "@/features/alchemy/run-loop/screens/generic-shop-screen";

vi.mock(
  "@/features/alchemy/run-loop/screens/shop-browse-shell",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
afterEach(cleanup);

it("clears purchase failures after a retry or shelf replacement", () => {
  const onBuy = vi.fn(() => true).mockReturnValueOnce(false);
  const props = {
    title: "Card Shop",
    gold: 100,
    items: ["Health Potion"],
    refreshesLeft: 1,
    refreshPrice: 10,
    purchasedSlotKeys: [],
    getSlotKey: (item: string) => `${item}:0`,
    getPrice: () => 20,
    onBuy,
    onRefresh: () => {},
    onContinue: () => {},
    renderItem: (item: string, _price: number, _purchased: boolean, buy: () => void) => (
      <button onClick={buy}>Buy {item}</button>
    ),
  };
  const { rerender } = render(<GenericShopScreen {...props} />);
  const buy = screen.getByRole("button", { name: "Buy Health Potion" });
  fireEvent.click(buy);
  expect(onBuy).toHaveBeenCalledWith("Health Potion:0");
  expect(screen.getByRole("alert").textContent).toMatch(/could not.*purchase/i);
  fireEvent.click(buy);
  expect(screen.queryByRole("alert")).toBeNull();
  onBuy.mockReturnValueOnce(false);
  fireEvent.click(buy);
  expect(screen.getByRole("alert")).toBeTruthy();
  rerender(<GenericShopScreen {...props} items={["Mana Potion"]} refreshesLeft={0} />);
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Buy Mana Potion" }));
  expect(screen.queryByRole("alert")).toBeNull();
});
