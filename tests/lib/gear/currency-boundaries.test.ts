import { expect, it } from "vitest";
import { addCraftingCurrencies } from "@/lib/gear/crafting-ids";

it("keeps a currency payout spendable when adding it would exceed the safe integer limit", () => {
  const balances = addCraftingCurrencies({ voidstone: Number.MAX_SAFE_INTEGER }, { voidstone: 2 });
  expect(balances.voidstone).toBe(Number.MAX_SAFE_INTEGER);
  expect(balances.voidstone - 1).toBeLessThan(balances.voidstone);
});
