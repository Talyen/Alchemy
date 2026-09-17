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
});
