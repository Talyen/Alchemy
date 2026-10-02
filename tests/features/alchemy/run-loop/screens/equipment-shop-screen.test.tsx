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
      gear={[testGear]}
      refreshesLeft={1}
      purchasedSlotKeys={purchasedSlotKeys}
      getGearPrice={() => 60}
      refreshPrice={15}
      onBuyGear={onBuyGear}
      onRefresh={vi.fn()}
      onContinue={vi.fn()}
    />
  );
  const { rerender } = render(view([]));
  await userEvent.click(screen.getByRole("button", { name: "Buy Longsword" }));
  expect(onBuyGear).toHaveBeenCalledExactlyOnceWith(testGear, "iron-sword-1");
  rerender(view(["iron-sword-1"]));
  const purchased = screen.getByRole("button", { name: "Longsword" });
  expect(purchased).toHaveProperty("disabled", true);
  await userEvent.click(purchased);
  expect(onBuyGear).toHaveBeenCalledOnce();
});
