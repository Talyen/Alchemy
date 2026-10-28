import { describe, expect, it } from "vitest";
import { dealDamage, makeEffect, makeTestCard, regressionBattle, type BattleStatePatch } from "../../fixtures/battle";

describe("Holy damage", () => {
  it.each<{ name: string; patch: BattleStatePatch; damage: number; equalToBlock?: boolean }>([
    { name: "Gold scaling", patch: { gold: 50, talentEffects: { holyGoldPercent: 10 } }, damage: 10 },
    { name: "current Block", patch: { playerStatuses: { block: 7 } }, damage: 7, equalToBlock: true },
    {
      name: "Block scaling",
      patch: { playerStatuses: { block: 10 }, talentEffects: { blockHolyDamagePercent: 30 } },
      damage: 8,
    },
    {
      name: "Burning enemies",
      patch: { enemyStatuses: { burn: 5 }, talentEffects: { holyVsBurnMultiplier: 50 } },
      damage: 8,
    },
  ])("applies $name exactly", ({ patch, damage, equalToBlock }) => {
    const state = regressionBattle(patch);
    const effect = makeEffect("holy", 5, { equalToBlock });
    expect(dealDamage(state, makeTestCard({ effects: [effect] })).enemyHealth).toBe(30 - damage);
  });

  it.each([
    { type: "holy", burning: true, stunned: false, expected: 15 },
    { type: "holy", burning: false, stunned: false, expected: 10 },
    { type: "physical", burning: true, stunned: false, expected: 10 },
    { type: "holy", burning: false, stunned: true, expected: 15 },
    { type: "physical", burning: false, stunned: true, expected: 10 },
    { type: "holy", burning: true, stunned: true, expected: 20 },
  ] as const)(
    "applies Holy bonuses only to matching damage and enemy conditions: $type, burn=$burning, stun=$stunned",
    ({ type, burning, stunned, expected }) => {
      const state = regressionBattle({
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyStatuses: { burn: burning ? 1 : 0 },
        enemyCC: { stunSkipTurns: stunned ? 1 : 0 },
        talentEffects: { holyVsBurnMultiplier: 50 },
        gearEffects: { holyBonusVsStunnedPercent: 50 },
      });
      const result = dealDamage(state, makeTestCard({ effects: [makeEffect(type, 10)] }));
      expect(result.enemyHealth).toBe(100 - expected);
    },
  );

  it("adds Holy Gear conversions from current Block and Gold without spending either", () => {
    const state = regressionBattle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { block: 20 },
      gold: 30,
      gearEffects: { holyDamageFromBlockPercent: 50, holyDamageFromGoldPercent: 20 },
    });
    const card = makeTestCard({ effects: [makeEffect("holy", 10)] });
    const result = dealDamage(state, card);
    expect(result.enemyHealth).toBe(74);
    expect(result.playerStatuses.block).toBe(20);
    expect(result.gold).toBe(30);
  });

  it("restores half the damage as Health through Holy Leech", () => {
    const state = regressionBattle({ playerHealth: 10, talentEffects: { holyLifestealPercent: 50 } });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("holy", 10)] }));
    expect(result.playerHealth).toBe(15);
  });

  it("applies Burn when its Holy damage rider succeeds", () => {
    const state = regressionBattle({ rng: () => 0.1, talentEffects: { holyBurnDamageChance: 50 } });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("holy", 10)] }));
    expect(result.enemyStatuses.burn).toBeGreaterThan(0);
  });

  it.each([0.1, 0.99])("offers a Wish only when the Holy rider succeeds at roll %s", (roll) => {
    const state = regressionBattle({ rng: () => roll, talentEffects: { holyWishChance: 50 } });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("holy", 10)] }));
    expect(result.wishOptions !== null).toBe(roll < 0.5);
  });
});
