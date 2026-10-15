import { describe, expect, it } from "vitest";
import { dealDamage, makeEffect, makeTestCard, regressionBattle } from "../../fixtures/battle";

const arrow = makeTestCard({ tags: ["archery"], effects: [makeEffect("physical", 10)] });

describe("Archery damage", () => {
  it("adds flat Arrow damage only to Archery cards", () => {
    const state = regressionBattle({ talentEffects: { flatArrowDamage: 3 } });
    expect(dealDamage(state, arrow).enemyHealth).toBe(17);
    expect(dealDamage(state, makeTestCard({ effects: arrow.effects })).enemyHealth).toBe(20);
  });

  it.each([
    ["archeryDoubledVsHighHealth", 100, 80],
    ["archeryDoubledVsHighHealth", 99, 89],
    ["archeryDoubledVsLowHealth", 19, 0],
    ["archeryDoubledVsLowHealth", 20, 10],
    ["archeryDoubledVsLowHealth", 21, 11],
  ] as const)("applies %s at %i/100 Health", (field, enemyHealth, expectedHealth) => {
    const state = regressionBattle({ enemyHealth, enemyMaxHealth: 100, talentEffects: { [field]: true } });
    expect(dealDamage(state, arrow).enemyHealth).toBe(expectedHealth);
  });

  it("Trophy Shot grants Gold when Archery defeats an enemy", () => {
    const state = regressionBattle({ enemyHealth: 10, enemyMaxHealth: 100, talentEffects: { goldOnArcheryKill: 2 } });
    const result = dealDamage(state, arrow);
    expect(result.enemyHealth).toBe(0);
    expect(result.gold).toBe(2);
  });

  it("Broadhead applies Bleed when its Archery rider succeeds", () => {
    const state = regressionBattle({
      enemyHealth: 50,
      enemyMaxHealth: 50,
      talentEffects: { archeryBleedDamageChance: 100 },
      rng: () => 0.1,
    });
    const result = dealDamage(state, arrow);
    expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
  });
});

it("typed damage bonuses adds flat Stun damage", () => {
  const state = regressionBattle({ gearEffects: { flatStunDamage: 2 } });
  expect(dealDamage(state, makeTestCard({ effects: [makeEffect("stun", 5)] })).enemyHealth).toBe(23);
});
