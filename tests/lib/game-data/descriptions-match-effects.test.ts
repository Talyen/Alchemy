// Validates every card, enemy, and boon description advertises the same kinds
// of effects it actually performs. Keeps hand-authored text structurally honest.
//
// Cardinal rule: the compendium is the single source of truth for display data.
// Any file that authors its own description strings for enemies/cards/boons
// instead of reading from the compendium will be flagged here and deleted.

import { describe, expect, it } from "vitest";
import {
  cardLibrary,
  companionLibrary,
  enemyBestiary,
  expectedCompanionTurnLine,
  trinketLibrary,
  type BattleCardEffect,
} from "@/lib/game-data";
import {
  validateCardDescriptionParity,
  validateEnemyTraitDescriptionParity,
  validateTrinketDescriptionParity,
  TRAIT_REQUIRED_PATTERNS,
  TRINKET_REQUIRED_PATTERNS,
} from "@/lib/content-validation/card-parity";

// ─────────────────────────── Cards ───────────────────────────

describe("card descriptions vs effects", () => {
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

  it.each(cardLibrary.map((c) => [c.id, c.title] as const))("%s — descriptions match effects", (_id, title) => {
    const card = cardLibrary.find((c) => c.title === title)!;
    const issues = validateCardDescriptionParity(card);
    expect(issues, issues.map((i) => i.message).join("; ")).toEqual([]);
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
          /^Cleanses \d+/.test(l) ||
          /^Steals \d+/.test(l) ||
          /^Gains? \d+ Block/.test(l) ||
          /^Draws \d+/.test(l) ||
          / or /.test(l),
      );
      expect(companionLine, `${card.id} missing companion turn line`).toBeDefined();
      expect(companionLine).toBe(expectedCompanionTurnLine(turnEffect));
      expect(card.descriptionLines.some((l) => l === "Companion")).toBe(true);
    }
  });

  it("every 'Gain' line references a known effect type", () => {
    const knownGainTargets = ["Block", "Armor", "Forge", "Health", "Maximum Mana", "Gold"];
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

// ─────────────────────────── Enemies ───────────────────────────

describe("enemy descriptions vs attack effects", () => {
  it.each(enemyBestiary.map((e) => [e.id, e.title] as const))("%s — attack effects have valid kinds", (_id, title) => {
    const enemy = enemyBestiary.find((e) => e.title === title)!;
    for (const effect of enemy.attackEffects) {
      expect(["damage", "player-status"]).toContain(effect.kind);
      if (effect.kind === "damage") {
        expect(typeof effect.amount).toBe("number");
        expect(effect.amount).toBeGreaterThan(0);
      }
      if (effect.kind === "player-status") {
        expect(typeof effect.amount).toBe("number");
        expect(effect.amount).toBeGreaterThan(0);
      }
    }
  });

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

// ─────────────────────────── Boons ───────────────────────────

describe("boon descriptions vs manifest effects", () => {
  it("every boon has a registered description check in TRINKET_REQUIRED_PATTERNS", () => {
    for (const boon of trinketLibrary) {
      expect(TRINKET_REQUIRED_PATTERNS[boon.id]).toBeDefined();
    }
  });

  it("every registered trinket pattern has a matching compendium entry", () => {
    const libraryIds: Set<string> = new Set(trinketLibrary.map((t) => t.id));
    for (const id of Object.keys(TRINKET_REQUIRED_PATTERNS)) {
      expect(libraryIds.has(id)).toBe(true);
    }
  });

  it.each(trinketLibrary.map((t) => [t.id, t.title] as const))(
    "%s — description mentions key mechanic",
    (_id, title) => {
      const boon = trinketLibrary.find((t) => t.title === title)!;
      const issues = validateTrinketDescriptionParity(boon);
      expect(issues, issues.map((i) => i.message).join("; ")).toEqual([]);
    },
  );

  it("every boon has at least one non-empty description line", () => {
    for (const boon of trinketLibrary) {
      expect(boon.descriptionLines.length).toBeGreaterThan(0);
      for (const line of boon.descriptionLines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });
});
