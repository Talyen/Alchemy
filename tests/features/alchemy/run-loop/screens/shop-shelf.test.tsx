import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EquipmentShopScreen } from "@/features/alchemy/run-loop/screens/equipment-shop-screen";
import { TrinketShopScreen } from "@/features/alchemy/run-loop/screens/trinket-shop-screen";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";
import { installFocusInputForTests } from "../../../../helpers/focus-input-test";

installReadyArtworkForTests();
installFocusInputForTests(true);
afterEach(cleanup);

const trinket = { id: "lucky-coin", title: "Lucky Coin", descriptionLines: ["Gain 5 gold."], art: "", effects: {} };
const shelf = { refreshesLeft: 1, refreshPrice: 15, getPrice: () => 50, onRefresh: vi.fn(), onContinue: vi.fn() };

it.each([
  { name: "Gear", title: "Longsword", slot: "iron-sword-1" },
  { name: "Trinket", title: "Lucky Coin", slot: "lucky-coin-0" },
])("$name remains inspectable without Gold, buys the offered identity, and blocks repeat purchases", async (offer) => {
  const onBuy = vi.fn(() => true);
  const view = (gold: number, purchasedSlotKeys: string[] = []) => {
    const props = { ...shelf, gold, purchasedSlotKeys, onBuy };
    return offer.name === "Gear" ? (
      <EquipmentShopScreen
        {...props}
        items={[{ instanceId: "iron-sword-1", definitionId: "longsword-basic", affixes: [] }]}
      />
    ) : (
      <TrinketShopScreen {...props} items={[trinket]} />
    );
  };
  const { rerender } = render(view(20));
  const user = userEvent.setup();
  const buy = screen.getByRole("button", { name: `Buy ${offer.title} for 50 Gold. Not enough Gold` });
  await waitForArtwork();
  for (let step = 0; step < 10 && document.activeElement !== buy; step += 1) await user.tab();
  expect(document.activeElement).toBe(buy);
  expect(buy.getAttribute("aria-disabled")).toBe("true");
  await waitFor(() =>
    expect(screen.getAllByRole("tooltip").map((tip) => tip.textContent)).toContain("Not Enough Gold"),
  );
  await user.keyboard("{Enter} ");
  await user.click(buy);
  expect(onBuy).not.toHaveBeenCalled();
  rerender(view(100));
  await user.click(screen.getByRole("button", { name: `Buy ${offer.title} for 50 Gold` }));
  expect(onBuy).toHaveBeenCalledExactlyOnceWith(offer.slot);
  rerender(view(50, [offer.slot]));
  const purchased = screen.getByRole("button", { name: `${offer.title}. Purchased` });
  expect(purchased.getAttribute("aria-disabled")).toBe("true");
  purchased.focus();
  expect(document.activeElement).toBe(purchased);
  await user.keyboard("{Enter} ");
  await user.click(purchased);
  expect(onBuy).toHaveBeenCalledOnce();
});

it("explains the completed Trinket collection and prevents refreshing the empty shelf", async () => {
  const onRefresh = vi.fn();
  render(
    <TrinketShopScreen
      {...shelf}
      gold={100}
      items={[]}
      purchasedSlotKeys={[]}
      onBuy={() => false}
      onRefresh={onRefresh}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain("All Trinkets have been collected");
  const refresh = screen.getByRole("button", { name: /Refresh/ });
  expect(refresh).toHaveProperty("disabled", true);
  await userEvent.click(refresh);
  expect(onRefresh).not.toHaveBeenCalled();
});
