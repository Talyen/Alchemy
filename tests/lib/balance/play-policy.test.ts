import { describe, expect, it } from "vitest";
import { getEffectiveDamageScore, getImmediateDamage } from "@/lib/balance/play-policy";
import { makeTestBattleState } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

const slash = makeTestCard({
  id: "test-slash",
  title: "Slash",
  effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
});

const ignite = makeTestCard({
  id: "test-ignite",
  title: "Ignite",
  effects: [{ kind: "enemy-status", status: "burn", amount: 10 }],
});

describe("getImmediateDamage", () => {
  it("scores direct damage and average random-damage", () => {
    const randomStrike = makeTestCard({
      id: "test-random",
      title: "Random Strike",
      effects: [{ kind: "random-damage", minAmount: 2, maxAmount: 8 }],
    });
    expect(getImmediateDamage(slash)).toBe(4);
    expect(getImmediateDamage(ignite)).toBe(0);
    expect(getImmediateDamage(randomStrike)).toBe(5);
  });
});

describe("getEffectiveDamageScore", () => {
  it("scores DoT setup above weaker face damage", () => {
    const state = makeTestBattleState();
    expect(getImmediateDamage(ignite)).toBe(0);
    expect(getImmediateDamage(slash)).toBe(4);
    expect(getEffectiveDamageScore(ignite, state)).toBeGreaterThan(getEffectiveDamageScore(slash, state));
  });
});
