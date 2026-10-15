import { describe, expect, it } from "vitest";
import { companionLibrary, getModifiedCompanionEffects } from "@/lib/game-data";

describe("companionLibrary data integrity", () => {
  it("applies Bond once before damage bonuses and rounding without changing authored effects", () => {
    const companion = companionLibrary.wolf;
    const before = structuredClone(companion.turnStartEffects);
    expect(
      getModifiedCompanionEffects(companion, 2, {
        damageBonus: 0.5,
        damageMultiplier: 1.5,
      }),
    ).toEqual([{ ...companion.turnStartEffects[0], amount: 5 }]);
    expect(companion.turnStartEffects).toEqual(before);
  });
});
