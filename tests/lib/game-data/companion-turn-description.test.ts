import { describe, expect, it } from "vitest";
import { formatCompanionTurnLineBase } from "@/lib/game-data/cards/companion-turn-description";
import type { BattleCardEffect } from "@/lib/game-data";

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
    expect(formatCompanionTurnLineBase(effect)).toBe("Draws 1 Card each turn");
  });

  it("formats plural draw-cards", () => {
    const effect: BattleCardEffect = { kind: "draw-cards", amount: 2 };
    expect(formatCompanionTurnLineBase(effect)).toBe("Draws 2 Cards each turn");
  });
});
