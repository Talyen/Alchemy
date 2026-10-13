import { describe, expect, it } from "vitest";
import {
  dealDamage,
  makeCombatTexts,
  makeEffect,
  makeTestCard,
  regressionBattle,
  type BattleStatePatch,
} from "../../fixtures/battle";

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

  it("restores half the damage as Health through Holy Leech", () => {
    const state = regressionBattle({ playerHealth: 10, talentEffects: { holyLifestealPercent: 50 } });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("holy", 10)] }));
    expect(result.playerHealth).toBe(15);
  });

  it("reports all Block gained, including the flat Gear bonus", () => {
    const state = regressionBattle({
      talentEffects: { holyBlockPercentFromDamage: 50 },
      gearEffects: { flatBlockGained: 2 },
    });
    const texts = makeCombatTexts();
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("holy", 10)] }), texts);
    expect(result.playerStatuses.block).toBe(7);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 7 });
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
