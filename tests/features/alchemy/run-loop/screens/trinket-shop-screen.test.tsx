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

it("buys the offered identity and prevents a repeat purchase of its slot", async () => {
  const onBuyTrinket = vi.fn(() => true);
  const view = (purchasedSlotKeys: string[]) => (
    <TrinketShopScreen
      gold={100}
      trinkets={[testTrinket]}
      refreshesLeft={1}
      purchasedSlotKeys={purchasedSlotKeys}
      getTrinketPrice={() => 50}
      refreshPrice={15}
      onBuyTrinket={onBuyTrinket}
      onRefresh={vi.fn()}
      onContinue={vi.fn()}
    />
  );
  const { rerender } = render(view([]));
  await userEvent.click(screen.getByRole("button", { name: "Buy Lucky Coin" }));
  expect(onBuyTrinket).toHaveBeenCalledExactlyOnceWith(testTrinket, "lucky-coin-0");
  rerender(view(["lucky-coin-0"]));
  const purchased = screen.getByRole("button", { name: "Lucky Coin" });
  expect(purchased).toHaveProperty("disabled", true);
  await userEvent.click(purchased);
  expect(onBuyTrinket).toHaveBeenCalledOnce();
});
