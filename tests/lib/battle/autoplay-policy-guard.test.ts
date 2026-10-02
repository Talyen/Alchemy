import { describe, expect, it } from "vitest";
import { AUTOPLAY_EFFECT_SCORE, getEffectiveDamageScore, getImmediateDefense } from "@/lib/battle/autoplay-policy";
import type { BattleCard } from "@/lib/game-data";
import * as simPolicy from "@/lib/balance/play-policy";
import { makeTestBattleState } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

// Live autoplay weights are game design. Any change alters autoplay and Wish
// picks in real runs, so it needs explicit design approval. The simulator
// currently shares this policy; fork sim-local scoring instead of retuning live.
describe("autoplay policy guard", () => {
  it("pins live scoring weights", () => {
    expect({ ...AUTOPLAY_EFFECT_SCORE }).toEqual({
      defense: 0.5,
      cleanse: 3,
      draw: 2,
      mana: 2,
      summon: 6,
      companionBuff: 2,
      criticalHit: 4,
      repeatCard: 5,
      wish: 3,
    });
  });

  it("keeps simulator sharing live scoring until an intentional fork", () => {
    const slash = makeTestCard({
      id: "guard-slash",
      title: "Slash",
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const state = makeTestBattleState();
    expect(simPolicy.getEffectiveDamageScore(slash, state)).toBe(getEffectiveDamageScore(slash, state));
    expect(simPolicy.EFFECT_SCORE).toBe(AUTOPLAY_EFFECT_SCORE);
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
    const state = makeTestBattleState({
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
    const state = makeTestBattleState({ playerStatuses: { burn: 2, poison: 1, stun: 0 } });
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
