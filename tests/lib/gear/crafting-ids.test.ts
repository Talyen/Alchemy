import { describe, expect, it } from "vitest";
import {
  CRAFTING_CURRENCY_IDS,
  EMPTY_CRAFTING_CURRENCIES,
  addCraftingCurrencies,
  normalizeCraftingCurrencies,
} from "@/lib/gear/crafting-ids";

describe("crafting-ids", () => {
  it("defines expected currency ids", () => {
    expect([...CRAFTING_CURRENCY_IDS]).toEqual([
      "discordant-dice",
      "sprig-of-growth",
      "voidstone",
      "ascension-seal",
      "severance-maw",
      "smiths-whetstone",
    ]);
  });

  it("normalizes and merges currencies without art dependency", () => {
    expect(EMPTY_CRAFTING_CURRENCIES).toEqual({
      "discordant-dice": 0,
      "sprig-of-growth": 0,
      voidstone: 0,
      "ascension-seal": 0,
      "severance-maw": 0,
      "smiths-whetstone": 0,
    });
    expect(normalizeCraftingCurrencies({ voidstone: 2, unknown: 5 })).toEqual({
      ...EMPTY_CRAFTING_CURRENCIES,
      voidstone: 2,
    });
    expect(addCraftingCurrencies({ voidstone: 1 }, { voidstone: 2 })).toEqual({
      ...EMPTY_CRAFTING_CURRENCIES,
      voidstone: 3,
    });
  });
});
