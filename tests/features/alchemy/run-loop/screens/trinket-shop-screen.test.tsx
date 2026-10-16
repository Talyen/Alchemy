import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TrinketShopScreen } from "@/features/alchemy/run-loop/screens/trinket-shop-screen";
import type { TrinketEntry } from "@/lib/game-data";
import { installReadyArtworkForTests } from "../../../../helpers/artwork-test";

const testTrinket: TrinketEntry = {
  id: "lucky-coin",
  title: "Lucky Coin",
  descriptionLines: ["Gain 5 gold."],
  art: "",
  effects: {},
};
installReadyArtworkForTests();
afterEach(cleanup);

it("explains the completed collection and disables a refresh of the empty shelf", async () => {
  const onRefresh = vi.fn();
  render(
    <TrinketShopScreen
      gold={100}
      items={[]}
      refreshesLeft={1}
      purchasedSlotKeys={[]}
      getPrice={() => 50}
      refreshPrice={15}
      onBuy={() => false}
      onRefresh={onRefresh}
      onContinue={() => {}}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain("All Trinkets have been collected");
  const refresh = screen.getByRole("button", { name: /Refresh/ });
  expect((refresh as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(refresh);
  expect(onRefresh).not.toHaveBeenCalled();
});

it("buys the offered identity and prevents a repeat purchase of its slot", async () => {
  const onBuyTrinket = vi.fn(() => true);
  const view = (purchasedSlotKeys: string[]) => (
    <TrinketShopScreen
      gold={100}
      items={[testTrinket]}
      refreshesLeft={1}
      purchasedSlotKeys={purchasedSlotKeys}
      getPrice={() => 50}
      refreshPrice={15}
      onBuy={onBuyTrinket}
      onRefresh={vi.fn()}
      onContinue={vi.fn()}
    />
  );
  const { rerender } = render(view([]));
  await userEvent.click(screen.getByRole("button", { name: "Buy Lucky Coin for 50 Gold" }));
  expect(onBuyTrinket).toHaveBeenCalledExactlyOnceWith(testTrinket, "lucky-coin-0");
  rerender(view(["lucky-coin-0"]));
  const purchased = screen.getByRole("button", { name: "Lucky Coin. Purchased" });
  expect(purchased.getAttribute("aria-disabled")).toBe("true");
  purchased.focus();
  expect(document.activeElement).toBe(purchased);
  await userEvent.keyboard("{Enter}");
  await userEvent.click(purchased);
  expect(onBuyTrinket).toHaveBeenCalledOnce();
});
