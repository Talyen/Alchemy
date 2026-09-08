import { describe, expect, it } from "vitest";
import {
  formatCompanionTurnLineBase,
  formatCompanionTurnStartLine,
} from "@/lib/game-data/cards/companion-turn-description";
import { companionLibrary, getCompanionDescriptionLines, type BattleCardEffect } from "@/lib/game-data";

describe("formatCompanionTurnLineBase", () => {
  it("formats damage with amount override", () => {
    const effect: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 2 };
    expect(formatCompanionTurnLineBase(effect, 5)).toBe("Deals 5 Physical damage each turn");
  });

  it("formats damage without override", () => {
    const effect: BattleCardEffect = { kind: "damage", damageType: "nature", amount: 3 };
    expect(formatCompanionTurnLineBase(effect)).toBe("Deals 3 Nature damage each turn");
  });

  it("formats heal", () => {
    const effect: BattleCardEffect = { kind: "heal", amount: 4 };
    expect(formatCompanionTurnLineBase(effect)).toBe("Restores 4 Health each turn");
  });

  it("formats block from player-status", () => {
    const effect: BattleCardEffect = { kind: "player-status", status: "block", amount: 6 };
    expect(formatCompanionTurnLineBase(effect)).toBe("Gains 6 Block each turn");
  });

  it("returns null for non-block player-status", () => {
    const effect: BattleCardEffect = { kind: "player-status", status: "forge", amount: 3 };
    expect(formatCompanionTurnLineBase(effect)).toBeNull();
  });

  it("returns null for unsupported effect kinds", () => {
    const effect: BattleCardEffect = { kind: "enemy-status", status: "burn", amount: 1 };
    expect(formatCompanionTurnLineBase(effect)).toBeNull();
  });

  it("formats singular draw-cards", () => {
    const effect: BattleCardEffect = { kind: "draw-cards", amount: 1 };
    expect(formatCompanionTurnLineBase(effect)).toBe("Draws a card each turn");
  });

  it("formats plural draw-cards", () => {
    const effect: BattleCardEffect = { kind: "draw-cards", amount: 2 };
    expect(formatCompanionTurnLineBase(effect)).toBe("Draws 2 cards each turn");
  });
});

describe("formatCompanionTurnStartLine", () => {
  it("applies bond and damage bonuses to chance-nested fox damage", () => {
    const effect: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "damage", damageType: "bleed", amount: 1 }],
      failureEffects: [{ kind: "gain-gold", amount: 1 }],
    };
    expect(formatCompanionTurnStartLine(effect, { bondLevel: 2, damageBonus: 1 })).toBe(
      "Deals 4 Bleed damage or Grants 1 Gold each turn",
    );
  });
});

describe("Bond descriptions", () => {
  it.each([0, 1, 2, 3])("describes every effect at Bond %i", (level) => {
    expect(getCompanionDescriptionLines(companionLibrary.wolf, level)).toEqual([
      `Deals ${1 + level} Bleed damage and gains 1 Block each turn`,
    ]);
    expect(getCompanionDescriptionLines(companionLibrary.panther, level)).toEqual([
      `Deals ${2 + level} Bleed damage each turn`,
    ]);
    expect(getCompanionDescriptionLines(companionLibrary["will-o-wisp"], level)).toEqual([
      level === 0
        ? "Cleanses 1 harmful status effect each turn"
        : `Cleanses 1 harmful status effect and restores ${level} Health each turn`,
    ]);
    expect(getCompanionDescriptionLines(companionLibrary.fox, level)).toEqual([
      `Deals ${1 + level} Bleed damage or Grants ${1 + level} Gold each turn`,
    ]);
    for (const [id, baseline, action] of [
      ["mana-moth", "Grants 1 extra Mana each turn", "grant"],
      ["library-owl", "Draws a card each turn", "draw"],
    ] as const) {
      expect(getCompanionDescriptionLines(companionLibrary[id], level)).toEqual([
        baseline + (level === 0 ? "" : `, with a ${level * 25}% chance to ${action} 1 more`),
      ]);
    }
  });
});
