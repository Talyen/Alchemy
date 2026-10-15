import { expect, it } from "vitest";
import { addCraftingCurrencies, normalizeCraftingCurrencies } from "@/lib/gear/crafting-ids";

it("repairs unspendable currency balances without losing other currencies", () => {
  const balances = normalizeCraftingCurrencies({ "discordant-dice": Number.MAX_VALUE, voidstone: 3 });
  expect(balances["discordant-dice"]).toBe(0);
  expect(balances.voidstone).toBe(3);
});

it("keeps a currency payout spendable when adding it would exceed the safe integer limit", () => {
  const balances = addCraftingCurrencies({ voidstone: Number.MAX_SAFE_INTEGER }, { voidstone: 2 });
  expect(balances.voidstone).toBe(Number.MAX_SAFE_INTEGER);
  expect(balances.voidstone - 1).toBeLessThan(balances.voidstone);
});
