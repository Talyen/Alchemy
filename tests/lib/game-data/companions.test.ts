import { describe, expect, it } from "vitest";
import { companionLibrary, getModifiedCompanionEffects } from "@/lib/game-data";

describe("companionLibrary data integrity", () => {
  it("applies Bond once before type-specific bonuses and rounding without changing authored effects", () => {
    const companion = companionLibrary.wolf;
    const before = structuredClone(companion.turnStartEffects);
    expect(
      getModifiedCompanionEffects(companion, 2, {
        damageBonus: 0.5,
        bleedDamageBonus: 2,
        damageMultiplier: 1.5,
      }),
    ).toEqual([
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "damage", damageType: "bleed", amount: 8 }],
        failureEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
      },
    ]);
    expect(companion.turnStartEffects).toEqual(before);
  });
});
