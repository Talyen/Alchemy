import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { describe, expect, it } from "vitest";
import * as uniqueGearBattle from "../../fixtures/unique-gear-battle";

describe("Unique Gear unique card opportunities", () => {
  const { battle, attack, play } = uniqueGearBattle;

  it("Red Harvest returns one card and its discount expires next turn", () => {
    const card = attack("physical");
    const first = play(battle({ gearEffects: { returnFirstPhysicalCard: 1 } }), card);
    expect(first.hand).toHaveLength(1);
    expect(first.discard).toHaveLength(0);
    expect(computeEffectiveCost(first, first.hand[0]!).effectiveCost).toBe(1);
    const returned = first.hand[0]!;
    const second = playBattleCardResolved(first, returned.id, 0).state;
    expect(second.hand).toHaveLength(0);
    expect(second.discard).toHaveLength(1);
    const next = advanceToPlayerTurn(second);
    expect(computeEffectiveCost(next, next.hand[0]!).effectiveCost).toBe(2);
    expect(next.uniqueGear.redHarvestUsed).toBe(false);
  });

  it("Red Harvest never returns a Consumed card", () => {
    const result = play(battle({ gearEffects: { returnFirstPhysicalCard: 1 } }), attack("physical", { consume: true }));
    expect(result.hand).toHaveLength(0);
    expect(result.exhausted).toHaveLength(1);
  });

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

  it("Threefold Grace grants separate free cards each turn and counts all keywords on a mixed card", () => {
    const mixed = attack("burn", { tags: ["burn", "freeze"], cost: 4 });
    const state = play(battle({ mana: 0, gearEffects: { firstElementalCardsFree: 1 } }), mixed);
    expect(state.enemyHealth).toBe(990);
    expect(state.uniqueGear.freeBurnUsed).toBe(true);
    expect(state.uniqueGear.freeFreezeUsed).toBe(true);
    expect(computeEffectiveCost(state, attack("freeze")).effectiveCost).toBe(2);
    expect(computeEffectiveCost(state, attack("holy")).effectiveCost).toBe(0);
    expect(computeEffectiveCost(advanceToPlayerTurn(state), attack("freeze")).effectiveCost).toBe(0);
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

  it("full hands leave Red Harvest in discard without losing or duplicating cards", () => {
    const card = attack("physical", {
      effects: [
        { kind: "draw-cards", amount: 7 },
        { kind: "damage", damageType: "physical", amount: 10 },
      ],
    });
    const deck = Array.from({ length: 7 }, (_, i) => attack("holy", { id: "filler-" + i }));
    const result = play(battle({ deck, gearEffects: { returnFirstPhysicalCard: 1 } }), card);
    expect(result.hand).toHaveLength(7);
    expect(result.discard).toEqual([card]);
    expect(result.uniqueGear.redHarvestUid).toBeNull();
  });
});
