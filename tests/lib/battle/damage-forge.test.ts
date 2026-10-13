import { describe, expect, it } from "vitest";
import { dealDamage, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("computeBaseDamage — forge bonus", () => {
  it.each([
    ["burn", "forgeBurnDamagePercent"],
    ["holy", "forgeHolyDamagePercent"],
    ["bleed", "forgeBleedDamagePercent"],
  ] as const)("converts Forge into %s damage without spending stacks", (type, field) => {
    const state = patchBattleState({
      playerStatuses: { forge: 2 },
      talentEffects: { [field]: 100 },
    });
    const card = makeTestCard({ effects: [makeEffect(type, 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(23);
    expect(result.playerStatuses.forge).toBe(2);
  });
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
});
