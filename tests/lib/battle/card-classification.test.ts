import { describe, expect, it } from "vitest";
import {
  cardHasDamageType,
  cardHasKeyword,
  hasDamageEffect,
  isAttackCard,
  isNatureCard,
} from "@/lib/battle/card-classification";
import type { BattleCardEffect } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/cards";

describe("card classification", () => {
  it.each<{ name: string; effect: BattleCardEffect; type: string }>([
    { name: "direct", effect: { kind: "damage", damageType: "holy", amount: 2 }, type: "holy" },
    { name: "random", effect: { kind: "random-damage", minAmount: 1, maxAmount: 3 }, type: "physical" },
    {
      name: "cleanse",
      effect: { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "nature" },
      type: "nature",
    },
  ])("recognizes $name damage at every nesting position", ({ effect, type }) => {
    const heal: BattleCardEffect = { kind: "heal", amount: 1 };
    const variants: BattleCardEffect[] = [
      effect,
      { kind: "chance", probability: 0, successEffects: [effect], failureEffects: [heal] },
      { kind: "chance", probability: 1, successEffects: [heal], failureEffects: [effect] },
      {
        kind: "repeat-over-turns",
        remainingTurns: 2,
        effects: [{ kind: "chance", probability: 0.5, successEffects: [heal], failureEffects: [effect] }],
      },
    ];
    for (const nested of variants) {
      const card = makeTestCard({ effects: [nested] });
      expect(hasDamageEffect(card.effects)).toBe(true);
      expect(isAttackCard(card)).toBe(true);
      expect(cardHasDamageType(card, type)).toBe(true);
      expect(cardHasKeyword(card, type)).toBe(true);
      expect(cardHasDamageType(card, "freeze")).toBe(false);
      expect(isNatureCard(card)).toBe(type === "nature");
    }
  });

  it.each<BattleCardEffect[]>([
    [],
    [{ kind: "heal", amount: 1 }],
    [{ kind: "self-damage", damageType: "burn", amount: 1 }],
    [{ kind: "enemy-status", status: "poison", amount: 1 }],
    [{ kind: "repeat-over-turns", remainingTurns: 2, effects: [{ kind: "heal", amount: 1 }] }],
    [{ kind: "chance", probability: 0.5, successEffects: [{ kind: "heal", amount: 1 }], failureEffects: [] }],
  ])("keeps tags separate from damage for effects %j", (...effects) => {
    const card = makeTestCard({ effects, tags: ["nature", "archery"] });
    expect(hasDamageEffect(card.effects)).toBe(false);
    expect(isAttackCard(card)).toBe(false);
    expect(cardHasDamageType(card, "nature")).toBe(false);
    expect(cardHasKeyword(card, "nature")).toBe(true);
    expect(cardHasKeyword(card, "archery")).toBe(true);
    expect(cardHasKeyword(card, "missing")).toBe(false);
    expect(isNatureCard(card)).toBe(true);
  });
});
