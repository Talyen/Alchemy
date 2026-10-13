import { describe, expect, it } from "vitest";
import { cardLibrary } from "@/lib/game-data";

// Catalog-wide text↔effects parity is pinned clean by
// tests/lib/content-validation/content-validation.test.ts; failure paths live
// in tests/lib/content-validation/parity-negative.test.ts. This file keeps the
// card-specific invariants that are not parity rules.
describe("card descriptions vs effects", () => {
  it("keeps every playable catalog card at one Mana", () => {
    for (const card of cardLibrary) expect(card.cost, card.id).toBe(1);
  });
});
