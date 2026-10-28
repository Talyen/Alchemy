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

it.each([
  { forge: 0, expected: 3 },
  { forge: 5, expected: 6 },
])("explicit Forge scaling replaces the normal Forge bonus at $forge stacks", ({ forge, expected }) => {
  const state = patchBattleState({
    playerStatuses: { forge },
    talentEffects: { forgeBurnDamagePercent: 100 },
    rng: () => 0.99,
  });
  const card = makeTestCard({ effects: [makeEffect("burn", 3, { forgeBonusPercent: 50 })] });
  const result = dealDamage(state, card);
  expect(result.enemyHealth).toBe(30 - expected);
  expect(result.playerStatuses.forge).toBe(forge);
});

it.each([
  { shared: false, type: "burn", expected: 6 },
  { shared: false, type: "bleed", expected: 12 },
  { shared: true, type: "burn", expected: 12 },
  { shared: true, type: "bleed", expected: 12 },
] as const)(
  "shares the higher Forge conversion only when enabled: $type, shared=$shared",
  ({ shared, type, expected }) => {
    const state = patchBattleState({
      playerStatuses: { forge: 8 },
      talentEffects: { forgeBurnDamagePercent: 25, forgeBleedDamagePercent: 100 },
      gearEffects: { sharedBurnBleedBonuses: shared ? 1 : 0 },
      rng: () => 0.99,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect(type, 4)] }));
    expect(result.enemyHealth).toBe(30 - expected);
    expect(result.playerStatuses.forge).toBe(8);
  },
);

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
