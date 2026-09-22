import { describe, expect, it } from "vitest";
import { AUTOPLAY_EFFECT_SCORE, getEffectiveDamageScore } from "@/lib/battle/autoplay-policy";
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
});
