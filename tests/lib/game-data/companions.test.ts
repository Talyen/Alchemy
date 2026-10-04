import { describe, expect, it } from "vitest";
import { BattleCardEffectSchema, companionLibrary, getModifiedCompanionEffects } from "@/lib/game-data";

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

  describe("bonded bonus-trigger chance", () => {
    const noModifiers = { damageBonus: 0, bleedDamageBonus: 0, damageMultiplier: 1 };

    it.each(["mana-moth", "library-owl"] as const)(
      "bonded %s appends a bonus-trigger chance with an empty failure branch",
      (id) => {
        const effects = getModifiedCompanionEffects(companionLibrary[id], 2, noModifiers);
        expect(effects).toHaveLength(2);
        const bonus = effects[1];
        expect(bonus).toMatchObject({ kind: "chance", probability: 0.5, failureEffects: [] });
        expect(bonus?.kind === "chance" && bonus.successEffects).toEqual(companionLibrary[id].turnStartEffects);
      },
    );

    it("bonded bonus-trigger effects satisfy the effect schema", () => {
      for (const id of ["mana-moth", "library-owl"] as const) {
        for (const effect of getModifiedCompanionEffects(companionLibrary[id], 3, noModifiers)) {
          expect(BattleCardEffectSchema.safeParse(effect).success).toBe(true);
        }
      }
    });
  });
});
