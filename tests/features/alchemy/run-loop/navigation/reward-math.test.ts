import { describe, expect, it } from "vitest";
import { computeVictoryGold } from "@/features/alchemy/run-loop/navigation/reward-math";

describe("victory reward settlement", () => {
  it("includes every bonus before rounding earnings once, preserving the purse", () => {
    const input = Object.freeze({
      battleState: Object.freeze({ gold: 65 }),
      purseGold: 50,
      runBoons: ["smugglers-map"],
      gold: 10,
      eliteBonus: 3,
      generousBonus: 4,
      bossBonus: 5,
      talentGoldPerCombat: 2,
      goldMultiplier: 1.5,
    });
    expect(computeVictoryGold(input)).toEqual({ earnedBeforeMultiplier: 41, persistedGold: 112 });
    expect(input.battleState.gold).toBe(65);
    expect(input.purseGold).toBe(50);
  });

  it("boosts only the settled victory payout after difficulty scaling, leaving generated Gold and the purse alone", () => {
    const input = {
      battleState: { gold: 65 },
      purseGold: 50,
      runBoons: [],
      gold: 10,
      eliteBonus: 0,
      generousBonus: 0,
      bossBonus: 0,
      talentGoldPerCombat: 2,
      goldMultiplier: 1.5,
    };
    expect(computeVictoryGold({ ...input, goldFindBonus: 0.4 }).persistedGold).toBe(97);
    expect(computeVictoryGold({ ...input, gold: 0, goldFindBonus: 0.4 }).persistedGold).toBe(
      computeVictoryGold({ ...input, gold: 0 }).persistedGold,
    );
  });

  it("never charges the purse for a negative in-combat balance, even with a reward multiplier", () => {
    expect(
      computeVictoryGold({
        battleState: { gold: 4 },
        purseGold: 10,
        runBoons: [],
        gold: 3,
        eliteBonus: 0,
        generousBonus: 0,
        bossBonus: 0,
        talentGoldPerCombat: 0,
        goldMultiplier: 2,
      }),
    ).toEqual({ earnedBeforeMultiplier: 3, persistedGold: 16 });
  });
});
