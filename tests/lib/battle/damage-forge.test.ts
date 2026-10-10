import { describe, expect, it } from "vitest";
import { dealDamage, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";
import {
  defaultEnemyStatusValues,
  defaultPlayerStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
} from "../../fixtures/default-battle-state";

describe("computeBaseDamage — forge bonus", () => {
  it("adds forge bonus to physical damage", () => {
    const state = patchBattleState({ playerStatuses: defaultPlayerStatusValues({ forge: 3 }) });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.playerStatuses.forge).toBe(3);
  });

  it.each([
    ["burn", "forgeBurnDamagePercent"],
    ["holy", "forgeHolyDamagePercent"],
    ["bleed", "forgeBleedDamagePercent"],
  ] as const)("converts Forge into %s damage without spending stacks", (type, field) => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      talentEffects: { ...defaultTalentEffects, [field]: 100 },
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
      playerStatuses: defaultPlayerStatusValues({ forge: 5 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 4, forgeStunAmount: 2 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 15 }),
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
  });

  it("does not stun when forge is below threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ forge: 2 }),
      trinketEffects: defaultTrinketManifest({ forgeStunThreshold: 4, forgeStunAmount: 2 }),
    });
    const card = makeTestCard({ effects: [makeEffect("physical", 5)] });
    const result = dealDamage(state, card);
    expect(result.enemyCC.stunSkipTurns).toBe(0);
  });
});
