import { describe, expect, it } from "vitest";
import {
  AUTOPLAY_EFFECT_SCORE,
  getEffectiveDamageScore,
  getImmediateDefense,
  pickHighestScoring,
} from "@/lib/battle/autoplay-policy";
import type { BattleCard } from "@/lib/game-data";
import { makeTestBattleState, patchBattleState } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

describe("autoplay policy", () => {
  it("chooses a refill only when it has usable Mana room and keeps hand order on equal scores", () => {
    const refill = makeTestCard({ cost: 0, effects: [{ kind: "restore-mana", amount: 2 }] });
    const draw = makeTestCard({ cost: 0, effects: [{ kind: "draw-cards", amount: 1 }] });
    const playable = [
      { card: refill, index: 3 },
      { card: draw, index: 5 },
    ];
    for (const [mana, chosen] of [
      [1, 3],
      [2, 3],
      [3, 5],
    ]) {
      const state = makeTestBattleState({ mana, maxMana: 3, deck: [makeTestCard()] });
      expect(pickHighestScoring(playable, (card) => getEffectiveDamageScore(card, state))?.index).toBe(chosen);
    }
  });

  it("counts queued draws and Mana spent by the card before scoring its refill", () => {
    const draw = makeTestCard({ id: "draw", cost: 1, effects: [{ kind: "draw-cards", amount: 3 }] });
    const refill = makeTestCard({ id: "refill", cost: 1, effects: [{ kind: "restore-mana", amount: 2 }] });
    const hand = [draw, refill, ...Array.from({ length: 5 }, (_, index) => makeTestCard({ id: `filler-${index}` }))];
    const state = makeTestBattleState({
      hand,
      mana: 3,
      maxMana: 3,
      deck: Array.from({ length: 3 }, (_, index) => makeTestCard({ id: `next-${index}` })),
    });
    expect(getEffectiveDamageScore(draw, state)).toBe(3 * AUTOPLAY_EFFECT_SCORE.draw);
    expect(getEffectiveDamageScore(refill, state)).toBe(AUTOPLAY_EFFECT_SCORE.mana);
  });

  it("keeps conditional damage amounts and free-card Mana refill scoring", () => {
    const state = patchBattleState({
      mana: 3,
      maxMana: 3,
      playerStatuses: { block: 2 },
      enemyMitigation: { block: 1 },
      enemyCC: { freezeSkipTurns: 1 },
    });
    const score = (effect: BattleCard["effects"]) =>
      getEffectiveDamageScore(makeTestCard({ cost: 0, effects: effect }), state);
    expect(score([{ kind: "damage", damageType: "physical", amount: 4 }])).toBe(4);
    expect(score([{ kind: "damage", damageType: "physical", amount: 4, damageTypeIfTargetHasBlock: "holy" }])).toBe(4);
    expect(score([{ kind: "damage", damageType: "physical", amount: 4, blockCost: 0, blockDamageBonus: 3 }])).toBe(7);
    expect(
      score([
        {
          kind: "damage",
          damageType: "physical",
          amount: 4,
          blockCost: 2,
          blockDamageBonus: 3,
          damageTypeIfTargetFrozen: "freeze",
          amountIfTargetFrozen: 0,
        },
      ]),
    ).toBe(0);
    const refill = makeTestCard({ cost: 1, tags: ["holy"], effects: [{ kind: "restore-mana", amount: 2 }] });
    expect(getEffectiveDamageScore(refill, { ...state, flags: { ...state.flags, nextHolyCardFree: true } })).toBe(0);
  });

  it("preserves nested chance defense, including resource conversion and capped healing", () => {
    const card = makeTestCard({
      effects: [
        { kind: "player-status", status: "block", amount: 2 },
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [
            { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 2 },
            {
              kind: "chance",
              probability: 0.25,
              successEffects: [{ kind: "heal", amount: 20 }],
              failureEffects: [{ kind: "player-status", status: "armor", amount: 4 }],
            },
          ],
          failureEffects: [{ kind: "heal", amount: 5 }],
        },
      ],
    });
    const state = makeTestBattleState({ mana: 3, playerHealth: 99, playerMaxHealth: 100 });
    expect(getImmediateDefense(card, state)).toBe(7.125);
    expect(getImmediateDefense(card)).toBe(9.5);
  });

  it("keeps defensive status-pool averages and full-cleanse scores", () => {
    const state = patchBattleState({ playerStatuses: { burn: 2, poison: 1, stun: 0 } });
    const score = (effects: BattleCard["effects"]) =>
      getEffectiveDamageScore(makeTestCard({ cost: 0, effects }), state);
    expect(score([{ kind: "player-status", status: "block", amount: 6 }])).toBe(3);
    expect(score([{ kind: "player-status", status: "forge", amount: 6 }])).toBe(0);
    expect(
      score([{ kind: "player-status", status: "block", statusPool: ["block", "armor", "forge"], amount: 6 }]),
    ).toBe(2);
    expect(score([{ kind: "remove-harmful-status", removeAll: true }])).toBe(6);
  });
});
