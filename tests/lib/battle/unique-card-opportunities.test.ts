import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { describe, expect, it } from "vitest";
import * as uniqueGearBattle from "../../fixtures/unique-gear-battle";

describe("Unique Gear unique card opportunities", () => {
  const { battle, attack, play } = uniqueGearBattle;

  it("Returning Flight recovers the existing card before a reshuffle and discounts only its next play", () => {
    const card = attack("physical", { tags: ["archery"] });
    const state = play(battle({ gearEffects: { recoverLastArcheryCard: 1 } }), card);
    const next = advanceToPlayerTurn(state);
    expect(next.hand).toHaveLength(1);
    expect(next.discard).toHaveLength(0);
    expect(computeEffectiveCost(next, next.hand[0]!).effectiveCost).toBe(1);
    const result = playBattleCardResolved(next, card.id, 0).state;
    expect(result.mana).toBe(9);
    expect(result.uniqueGear.returningFlightUid).toBeNull();
  });

  it("Winter's Credit pays only the missing Mana with Block and rejects unaffordable cards", () => {
    const card = attack("freeze", { cost: 3 });
    const state = battle({
      mana: 1,
      hand: [card],
      playerStatuses: { block: 6 },
      gearEffects: { blockPaysFreezeMana: 1 },
    });
    expect(canPlayCard(state, card, 0)).toBe(true);
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.mana).toBe(0);
    expect(result.playerStatuses.block).toBe(0);
    const poor = { ...state, playerStatuses: { ...state.playerStatuses, block: 5 } };
    expect(canPlayCard(poor, card, 0)).toBe(false);
    expect(playBattleCardResolved(poor, card.id, 0).state).toBe(poor);
    expect(canPlayCard({ ...state, hand: [attack("burn", { cost: 3 })] }, attack("burn", { cost: 3 }), 0)).toBe(false);
  });

  it("Winter's Credit and Rimeheart pay Block first, and Final Spark repeats only once", () => {
    const card = attack("freeze", { cost: 3, effects: [{ kind: "damage", damageType: "freeze", amount: 15 }] });
    const result = play(
      battle({
        mana: 1,
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyStatuses: { freeze: 40 },
        playerStatuses: { block: 6 },
        gearEffects: { blockPaysFreezeMana: 1, freezeGrantsBlockAndMana: 1, lastManaElementalRepeat: 1 },
      }),
      card,
    );
    expect(result.enemyHealth).toBe(70);
    expect(result.playerStatuses.block).toBe(15);
    expect(result.mana).toBe(8);
    expect(result.uniqueGear.finalSparkUsed).toBe(true);
  });
});
