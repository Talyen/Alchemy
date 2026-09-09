import { describe, expect, it } from "vitest";
import {
  cardLibrary,
  companionLibrary,
  enemyBestiary,
  getCompanionDescriptionLines,
  type BattleCardEffect,
} from "@/lib/game-data";
import {
  validateCardDescriptionParity,
  validateEnemyTraitDescriptionParity,
  TRAIT_REQUIRED_PATTERNS,
} from "@/lib/content-validation/card-parity";

describe("card descriptions vs effects", () => {
  it("keeps every playable catalog card at one Mana", () => {
    for (const card of cardLibrary) expect(card.cost, card.id).toBe(1);
  });
  it("keeps Gambler's Shot range punctuation readable", () => {
    const card = cardLibrary.find((candidate) => candidate.id === "gamblers-shot");
    expect(card?.descriptionLines).toContain("Deal 1–6 Random damage");
  });

  it("rejects a repeated damage line when the second hit has a different amount", () => {
    const issues = validateCardDescriptionParity({
      id: "mismatched-repeat",
      title: "Mismatched Repeat",
      descriptionLines: ["Deal 1 Freeze damage, twice"],
      art: "",
      cost: 1,
      effects: [
        { kind: "damage", damageType: "freeze", amount: 1 },
        { kind: "damage", damageType: "freeze", amount: 2 },
      ],
    });

    expect(issues.map((issue) => issue.message)).toContain(
      '"Deal 1 Freeze damage, twice" does not match authored amount 2',
    );
  });

  it.each(cardLibrary.map((c) => [c.id, c.title, c] as const))(
    "%s — descriptions match effects",
    (_id, _title, card) => {
      const issues = validateCardDescriptionParity(card);
      expect(issues, issues.map((i) => i.message).join("; ")).toEqual([]);
    },
  );

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
          /^Draws (?:\d+|a) /.test(l) ||
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

describe("enemy trait descriptions", () => {
  it("every enemy trait is registered in TRAIT_REQUIRED_PATTERNS with valid text", () => {
    for (const enemy of enemyBestiary) {
      for (const trait of enemy.traits) {
        expect(trait.id.length).toBeGreaterThan(0);
        expect(trait.title.length).toBeGreaterThan(0);
        expect(trait.description.length).toBeGreaterThan(0);
        expect(TRAIT_REQUIRED_PATTERNS[trait.id]).toBeDefined();
      }
    }
  });

  it("trait descriptions match content-validation parity", () => {
    const issues = enemyBestiary.flatMap((enemy) => validateEnemyTraitDescriptionParity(enemy));
    expect(issues).toEqual([]);
  });
});
