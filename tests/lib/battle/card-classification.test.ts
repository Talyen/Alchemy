import { describe, expect, it } from "vitest";
import {
  cardHasDamageType,
  cardHasKeyword,
  getBattleCardPlayTarget,
  hasDamageEffect,
  isAttackCard,
  isNatureCard,
} from "@/lib/battle/card-classification";
import type { BattleCardEffect } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/cards";

describe("card classification", () => {
  it.each(["target", "damage"] as const)(
    "keeps targeting and later damage independent when queried by %s first",
    (first) => {
      const card = makeTestCard({
        effects: [
          { kind: "heal", amount: 1 },
          {
            kind: "chance",
            probability: 0.5,
            successEffects: [{ kind: "gain-gold", amount: 1 }],
            failureEffects: [
              {
                kind: "damage",
                damageType: "physical",
                amount: 2,
                damageTypeIfTargetHasBlock: "holy",
                damageTypeIfTargetFrozen: "burn",
              },
            ],
          },
        ],
      });
      if (first === "target") expect(getBattleCardPlayTarget(card)).toBe("player");
      else expect(cardHasDamageType(card, "burn")).toBe(true);
      expect(isAttackCard(card)).toBe(true);
      expect(getBattleCardPlayTarget(card)).toBe("player");
      for (const type of ["physical", "holy", "burn"]) expect(cardHasDamageType(card, type)).toBe(true);
      expect(cardHasDamageType(card, "freeze")).toBe(false);
    },
  );

  it("refreshes classifications when effects change while cost-only variants retain their classifications", () => {
    const card = makeTestCard({ effects: [{ kind: "heal", amount: 1 }] });
    expect(isAttackCard(card)).toBe(false);
    expect(cardHasDamageType(card, "burn")).toBe(false);
    const costVariant = { ...card, cost: 0 };
    card.effects = [{ kind: "damage", damageType: "burn", amount: 2 }];
    expect(isAttackCard(card)).toBe(true);
    expect(cardHasDamageType(card, "burn")).toBe(true);
    expect(isAttackCard(costVariant)).toBe(false);
    expect(cardHasDamageType(costVariant, "burn")).toBe(false);
  });

  it("recognizes every type in a pooled random-damage effect", () => {
    const card = makeTestCard({
      effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["stun", "physical", "bleed"] }],
    });
    expect(cardHasDamageType(card, "stun")).toBe(true);
    expect(cardHasDamageType(card, "physical")).toBe(true);
    expect(cardHasDamageType(card, "bleed")).toBe(true);
    expect(cardHasDamageType(card, "freeze")).toBe(false);
  });

  it("recognizes cleanse damage inside delayed and failed chance branches", () => {
    const effect: BattleCardEffect = {
      kind: "repeat-over-turns",
      remainingTurns: 2,
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "heal", amount: 1 }],
          failureEffects: [{ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "nature" }],
        },
      ],
    };
    const card = makeTestCard({ effects: [effect] });
    expect(hasDamageEffect(card.effects)).toBe(true);
    expect(cardHasDamageType(card, "nature")).toBe(true);
    expect(cardHasKeyword(card, "nature")).toBe(true);
  });

  it("keeps tags and non-attacking effects separate from damage through nested branches", () => {
    const card = makeTestCard({
      tags: ["nature", "archery"],
      effects: [
        { kind: "self-damage", damageType: "burn", amount: 1 },
        { kind: "enemy-status", status: "poison", amount: 1 },
        { kind: "player-status", status: "block", amount: 5 },
        {
          kind: "repeat-over-turns",
          remainingTurns: 2,
          effects: [
            { kind: "chance", probability: 0.5, successEffects: [{ kind: "heal", amount: 1 }], failureEffects: [] },
          ],
        },
      ],
    });
    expect(isAttackCard(card)).toBe(false);
    for (const type of ["nature", "burn", "poison"]) expect(cardHasDamageType(card, type)).toBe(false);
    expect(cardHasKeyword(card, "archery")).toBe(true);
    expect(cardHasKeyword(card, "missing")).toBe(false);
    expect(isNatureCard(card)).toBe(true);
  });
});
