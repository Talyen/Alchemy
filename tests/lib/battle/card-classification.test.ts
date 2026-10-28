import { describe, expect, it } from "vitest";
import {
  cardHasDamageType,
  cardHasKeyword,
  getBattleCardPlayTarget,
  hasDamageEffect,
  isAttackCard,
  isNatureCard,
} from "@/lib/battle/card-classification";
import { cardLibrary, DAMAGE_TYPES, getCardKeywords, type BattleCardEffect } from "@/lib/game-data";
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
                damageTypeIfTargetFrozen: "burn",
                amountIfTargetFrozen: 4,
              },
            ],
          },
        ],
      });
      if (first === "target") expect(getBattleCardPlayTarget(card)).toBe("player");
      else expect(cardHasDamageType(card, "burn")).toBe(true);
      expect(isAttackCard(card)).toBe(true);
      expect(getBattleCardPlayTarget(card)).toBe("player");
      for (const type of ["physical", "burn"]) expect(cardHasDamageType(card, type)).toBe(true);
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

  it("unrestricted Random damage advertises every type the resolver can roll", () => {
    const card = makeTestCard({ effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 3 }] });
    for (const type of DAMAGE_TYPES) {
      expect(cardHasDamageType(card, type), type).toBe(true);
      expect(getCardKeywords(card), type).toContain(type);
    }
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
        { kind: "remove-player-status", status: "poison" },
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

it("keeps the first nested target and refreshes it when the effects are replaced", () => {
  const card = makeTestCard({
    effects: [
      {
        kind: "repeat-over-turns",
        remainingTurns: 1,
        effects: [
          { kind: "chance", probability: 0.5, successEffects: [], failureEffects: [] },
          { kind: "heal", amount: 1 },
        ],
      },
      { kind: "damage", damageType: "physical", amount: 2 },
    ],
  });
  expect(getBattleCardPlayTarget(card)).toBe("player");
  const costVariant = { ...card, cost: 0 };
  card.effects = [{ kind: "damage", damageType: "physical", amount: 2 }];
  expect(getBattleCardPlayTarget(card)).toBe("enemy");
  expect(getBattleCardPlayTarget(costVariant)).toBe("player");
});

it("aims chance-card VFX from the failure branch when success has no target", () => {
  const card = makeTestCard({
    effects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [],
        failureEffects: [{ kind: "damage", damageType: "physical", amount: 3 }],
      },
    ],
  });
  expect(getBattleCardPlayTarget(card)).toBe("enemy");
});

it("keeps mutable and frozen classifications equal across the card catalog", () => {
  function freezeTree(value: unknown): void {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  for (const source of cardLibrary) {
    const mutable = structuredClone(source);
    const frozen = structuredClone(source);
    freezeTree(frozen.effects);
    expect(hasDamageEffect(mutable.effects), source.id).toBe(hasDamageEffect(frozen.effects));
    expect(getBattleCardPlayTarget(mutable), source.id).toBe(getBattleCardPlayTarget(frozen));
    for (const type of [...DAMAGE_TYPES, "missing"]) {
      expect(cardHasDamageType(mutable, type), `${source.id} ${type}`).toBe(cardHasDamageType(frozen, type));
    }
  }
});

it("reclassifies in-place changes to mutable nested effects", () => {
  const card = makeTestCard({
    effects: [{ kind: "chance", probability: 0.5, successEffects: [{ kind: "heal", amount: 1 }], failureEffects: [] }],
  });
  expect(isAttackCard(card)).toBe(false);
  expect(getBattleCardPlayTarget(card)).toBe("player");
  const chance = card.effects[0];
  if (chance?.kind !== "chance") throw new Error("Expected chance");
  chance.successEffects[0] = { kind: "damage", damageType: "burn", amount: 2 };
  expect(isAttackCard(card)).toBe(true);
  expect(cardHasDamageType(card, "burn")).toBe(true);
  expect(getBattleCardPlayTarget(card)).toBe("enemy");
});
