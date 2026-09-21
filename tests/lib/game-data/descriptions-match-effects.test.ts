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
  it("keeps Gambler's Shot range punctuation readable", () => {
    const card = cardLibrary.find((candidate) => candidate.id === "gamblers-shot");
    expect(card?.descriptionLines).toContain("Deal 1–4 Stun, Physical, or Bleed damage");
  });

  it("summon cards advertise companion turn damage from companionLibrary", () => {
    for (const card of cardLibrary) {
      const summon = card.effects.find(
        (e): e is Extract<BattleCardEffect, { kind: "summon-companion" }> => e.kind === "summon-companion",
      );
      if (!summon) continue;

      const companion = companionLibrary[summon.companionId];
      const turnEffect = companion.turnStartEffects[0];
      expect(turnEffect, `${card.id} companion missing turn-start effect`).toBeDefined();

      const companionLine = card.descriptionLines.find(
        (l) =>
          /^Deals \d+/.test(l) ||
          /^Restores \d+/.test(l) ||
          /^Grants \d+/.test(l) ||
          /^Cleanses \d+/.test(l) ||
          /^Steals \d+/.test(l) ||
          /^Gains? \d+ Block/.test(l) ||
          /^Gain \d+ Mana/.test(l) ||
          /^Draw (?:\d+|a) /.test(l) ||
          / or /.test(l),
      );
      expect(companionLine, `${card.id} missing companion turn line`).toBeDefined();
      expect(companionLine).toBe(getCompanionDescriptionLines(companion)[0]);
      expect(card.descriptionLines.some((l) => l === "Companion")).toBe(true);
    }
  });

  it("every 'Gain' line references a known effect type", () => {
    const knownGainTargets = ["Block", "Armor", "Thorns", "Forge", "Health", "Mana", "Gold"];
    for (const card of cardLibrary) {
      for (const line of card.descriptionLines) {
        if (line.startsWith("Gain ")) {
          const isKnown = knownGainTargets.some((t) => line.includes(t));
          expect(isKnown).toBe(true);
        }
      }
    }
  });
});
