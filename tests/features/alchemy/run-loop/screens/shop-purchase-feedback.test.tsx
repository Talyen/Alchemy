import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GenericShopScreen } from "@/features/alchemy/run-loop/screens/generic-shop-screen";

vi.mock(
  "@/features/alchemy/run-loop/screens/shop-browse-shell",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
afterEach(cleanup);

it("explains a rejected purchase and clears the error after a successful retry", () => {
  const onBuy = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(
    <GenericShopScreen
      title="Card Shop"
      gold={100}
      items={["Health Potion"]}
      refreshesLeft={1}
      refreshPrice={10}
      purchasedSlotKeys={[]}
      getSlotKey={() => "potion:0"}
      getPrice={() => 20}
      onBuy={onBuy}
      onRefresh={() => {}}
      onContinue={() => {}}
      renderItem={(item, _price, _purchased, buy) => <button onClick={buy}>Buy {item}</button>}
    />,
  );
  const buy = screen.getByRole("button", { name: "Buy Health Potion" });
  fireEvent.click(buy);
  expect(onBuy).toHaveBeenCalledWith("Health Potion", "potion:0");
  expect(screen.getByRole("alert").textContent).toMatch(/could not.*purchase/i);
  fireEvent.click(buy);
  expect(screen.queryByRole("alert")).toBeNull();
});
