import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary, getCompanionDescriptionLines, type BattleCardEffect } from "@/lib/game-data";

// Catalog-wide text↔effects parity is pinned clean by
// tests/lib/content-validation/content-validation.test.ts; failure paths live
// in tests/lib/content-validation/parity-negative.test.ts. This file keeps the
// card-specific invariants that are not parity rules.
describe("card descriptions vs effects", () => {
  it("keeps every playable catalog card at one Mana", () => {
    for (const card of cardLibrary) expect(card.cost, card.id).toBe(1);
  });

  it("summon cards advertise companion turn damage from companionLibrary", () => {
    for (const card of cardLibrary) {
      const summon = card.effects.find(
        (e): e is Extract<BattleCardEffect, { kind: "summon-companion" }> => e.kind === "summon-companion",
      );
      if (!summon) continue;

      const companion = companionLibrary[summon.companionId];
      expect(card.descriptionLines, card.id).toEqual([...getCompanionDescriptionLines(companion), "Companion"]);
    }
  });
});
