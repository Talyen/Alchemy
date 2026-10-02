import { expect, it } from "vitest";
import { cardById, enemyAbilityDealsDamage, getEnemyAbilityCard, isEnemyAbilityCard } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/battle";

it("reassesses replaced effects and card eligibility without retaining stale card classifications", () => {
  const card = makeTestCard({ effects: cardById.block.effects });
  expect(isEnemyAbilityCard(card)).toBe(true);
  expect(enemyAbilityDealsDamage(card)).toBe(false);
  card.effects = cardById.maul.effects;
  expect(enemyAbilityDealsDamage(card)).toBe(true);
  card.consume = true;
  expect(isEnemyAbilityCard(card)).toBe(false);
  card.consume = false;
  card.effects = cardById.wish.effects;
  expect(isEnemyAbilityCard(card)).toBe(false);
});

it("detects damage after an unsupported nested branch and diagnoses the actual unsupported leaf", () => {
  const card = makeTestCard({
    effects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: cardById.wish.effects,
        failureEffects: [
          {
            kind: "chance",
            probability: 0.5,
            successEffects: cardById.block.effects,
            failureEffects: cardById.maul.effects,
          },
        ],
      },
    ],
  });
  expect(isEnemyAbilityCard(card)).toBe(false);
  expect(enemyAbilityDealsDamage(card)).toBe(true);
  expect(() => getEnemyAbilityCard("wishing-well")).toThrow(/unsupported effect wish with fields/);
});
