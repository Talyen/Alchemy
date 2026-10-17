import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EquipmentShopScreen } from "@/features/alchemy/run-loop/screens/equipment-shop-screen";
import type { GearInstance } from "@/lib/gear";
import { installReadyArtworkForTests } from "../../../../helpers/artwork-test";

const testGear: GearInstance = {
  instanceId: "iron-sword-1",
  definitionId: "longsword-basic",
  affixes: [],
};
installReadyArtworkForTests();
afterEach(cleanup);

it("buys the offered identity and prevents a repeat purchase of its slot", async () => {
  const onBuyGear = vi.fn(() => true);
  const view = (purchasedSlotKeys: string[]) => (
    <EquipmentShopScreen
      gold={100}
      items={[testGear]}
      refreshesLeft={1}
      purchasedSlotKeys={purchasedSlotKeys}
      getPrice={() => 60}
      refreshPrice={15}
      onBuy={onBuyGear}
      onRefresh={vi.fn()}
      onContinue={vi.fn()}
    />
  );
  const { rerender } = render(view([]));
  await userEvent.click(screen.getByRole("button", { name: "Buy Longsword for 60 Gold" }));
  expect(onBuyGear).toHaveBeenCalledExactlyOnceWith("iron-sword-1");
  rerender(view(["iron-sword-1"]));
  const purchased = screen.getByRole("button", { name: "Longsword. Purchased" });
  expect(purchased.getAttribute("aria-disabled")).toBe("true");
  purchased.focus();
  expect(document.activeElement).toBe(purchased);
  await userEvent.keyboard("{Enter}");
  await userEvent.click(purchased);
  expect(onBuyGear).toHaveBeenCalledOnce();
});
