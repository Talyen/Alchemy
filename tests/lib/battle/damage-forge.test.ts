import { describe, expect, it } from "vitest";
import { dealDamage, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";

it.each([
  ["burn", "forgeBurnDamagePercent"],
  ["holy", "forgeHolyDamagePercent"],
  ["bleed", "forgeBleedDamagePercent"],
] as const)("computeBaseDamage — forge bonus converts Forge into %s damage without spending stacks", (type, field) => {
  const state = patchBattleState({
    playerStatuses: { forge: 2 },
    talentEffects: { [field]: 100 },
  });
  const card = makeTestCard({ effects: [makeEffect(type, 5)] });
  const result = dealDamage(state, card);
  expect(result.enemyHealth).toBe(23);
  expect(result.playerStatuses.forge).toBe(2);
});

it("computeBaseDamage — Expert Blacksmith rounds its Forge bonus before damage multipliers", () => {
  const state = patchBattleState({
    playerStatuses: { forge: 2 },
    talentEffects: { forgeToPhysicalDamageMultiplier: 1.25 },
    enemyStatuses: { bleed: 1 },
    rng: () => 0.99,
  });
  const card = makeTestCard({
    effects: [{ kind: "damage", damageType: "physical", amount: 3, doubleIfEnemyBleeding: true }],
  });
  const result = dealDamage(state, card);
  // Base 3 + round(2 × 1.25) = 6, doubled against the bleeding enemy.
  expect(result.enemyHealth).toBe(30 - 12);
});

describe("applyForgeStunRider", () => {
  it("stuns enemy when forge meets boon threshold", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 5 },
      trinketEffects: { forgeStunThreshold: 4, forgeStunAmount: 2 },
      enemyStatuses: { stun: 15 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("does not stun when forge is below threshold", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 2 },
      trinketEffects: { forgeStunThreshold: 4, forgeStunAmount: 2 },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyCC.stunSkipTurns).toBe(0);
  });

  it("does not stun or spend obsidian hammer when the hit defeats the enemy", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      playerStatuses: { forge: 5 },
      trinketEffects: { forgeStunThreshold: 4, forgeStunAmount: 2 },
      flags: { obsidianHammerUsedThisTurn: false },
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(0);
    expect(result.flags.obsidianHammerUsedThisTurn).toBe(false);
  });
});
