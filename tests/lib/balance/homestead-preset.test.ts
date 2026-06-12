import { describe, expect, it } from "vitest";
import { buildSimCompanionBondLevels, companionIdsFromDeck } from "@/lib/balance/homestead-preset";
import { getStartingDeck } from "@/lib/game-data";

describe("buildSimCompanionBondLevels", () => {
  it("bonds companions found in the deck by preset tier", () => {
    const deck = getStartingDeck("ranger");
    const ids = companionIdsFromDeck(deck);
    expect(ids.length).toBeGreaterThan(0);

    const early = buildSimCompanionBondLevels(deck, "early");
    const late = buildSimCompanionBondLevels(deck, "late");
    for (const id of ids) {
      expect(early[id]).toBe(1);
      expect(late[id]).toBe(3);
    }
  });

  it("leaves bond at zero for companions not in the deck", () => {
    const deck = getStartingDeck("knight");
    const bonds = buildSimCompanionBondLevels(deck, "late");
    expect(bonds.wolf).toBe(0);
  });
});
