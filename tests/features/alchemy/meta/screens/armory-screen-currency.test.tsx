// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CRAFTING_CURRENCY_LIST, EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import {
  createArmoryInventories,
  createArmoryScreenProps,
  installArmoryScreenTestHooks,
  renderArmoryScreen,
} from "./armory/armory-screen-test-helpers";
import { ArmoryScreen } from "@/features/alchemy/meta/screens/armory-screen";
import { render } from "@testing-library/react";

const AFFIXED_INVENTORY = createArmoryInventories([
  { instanceId: "gear-sword", definitionId: "longsword-basic", affixes: [{ id: "flat-physical", value: 2 }] },
]);

describe("ArmoryScreen crafting currencies", () => {
  installArmoryScreenTestHooks();

  it("applies the selected currency to gear", async () => {
    const user = userEvent.setup();
    const onApplyCurrency = vi.fn(() => true);
    renderArmoryScreen({
      inventories: AFFIXED_INVENTORY,
      craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone: 1 },
      onApplyCurrency,
    });

    await user.click(screen.getByLabelText("Use Voidstone"));
    await user.click(screen.getByRole("button", { name: /Apply Voidstone/ }));

    expect(onApplyCurrency).toHaveBeenCalledWith("voidstone", "gear-sword");
  });

  it("clears currency targeting when its count reaches zero", async () => {
    const user = userEvent.setup();
    const props = createArmoryScreenProps({
      inventories: AFFIXED_INVENTORY,
      craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone: 1 },
      onApplyCurrency: vi.fn(() => true),
    });
    const { rerender } = render(<ArmoryScreen {...props} />);
    await user.click(screen.getByLabelText("Use Voidstone"));

    rerender(<ArmoryScreen {...props} craftingCurrencies={{ ...EMPTY_CRAFTING_CURRENCIES, voidstone: 0 }} />);

    await waitFor(() => expect(screen.queryByRole("button", { name: /Apply Voidstone/ })).toBeNull());
  });

  it("clears targeting when browse-only mode becomes active", async () => {
    const user = userEvent.setup();
    const props = createArmoryScreenProps({
      inventories: AFFIXED_INVENTORY,
      craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone: 1 },
    });
    const { rerender } = render(<ArmoryScreen {...props} />);
    await user.click(screen.getByLabelText("Use Voidstone"));

    rerender(<ArmoryScreen {...props} browseOnly />);

    await waitFor(() => expect(screen.queryByRole("button", { name: /Apply Voidstone/ })).toBeNull());
  });

  it.each(CRAFTING_CURRENCY_LIST)("enters apply mode for $displayName", async ({ id, displayName }) => {
    const user = userEvent.setup();
    renderArmoryScreen({
      inventories: AFFIXED_INVENTORY,
      craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, [id]: 1 },
    });

    await user.click(screen.getByLabelText(`Use ${displayName}`));

    expect(screen.getByLabelText(`Use ${displayName}`).getAttribute("aria-pressed")).toBe("true");
  });
});
