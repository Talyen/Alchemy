import { describe, expect, it } from "vitest";
import { EMPTY_CRAFTING_CURRENCIES, addCraftingCurrencies, normalizeCraftingCurrencies } from "@/lib/gear/crafting-ids";

describe("crafting currency balances", () => {
  it("repairs invalid saved balances while retaining known nonnegative integer amounts", () => {
    const balances = Object.freeze({
      "discordant-dice": 2.8,
      "sprig-of-growth": -1,
      voidstone: Number.POSITIVE_INFINITY,
      "ascension-seal": Number.NaN,
      "severance-maw": "3",
      "smiths-whetstone": 4,
      unknown: 10,
    });
    expect(normalizeCraftingCurrencies(balances)).toEqual({
      ...EMPTY_CRAFTING_CURRENCIES,
      "discordant-dice": 2,
      "smiths-whetstone": 4,
    });
  });

  it("awards only valid currencies without mutating saved balances or shared defaults", () => {
    const base = Object.freeze({ voidstone: 2, "discordant-dice": Number.NaN });
    const awarded = Object.freeze({ voidstone: 3.9, "discordant-dice": -2, unknown: 9 });
    const result = addCraftingCurrencies(base, awarded);
    expect(result).toEqual({ ...EMPTY_CRAFTING_CURRENCIES, voidstone: 5 });
    result.voidstone = 0;
    expect(base.voidstone).toBe(2);
    expect(awarded.voidstone).toBe(3.9);
    expect(normalizeCraftingCurrencies(null).voidstone).toBe(0);
  });
});
