import { describe, expect, it, vi } from "vitest";
import { drawOpeningHand } from "@/lib/battle/battle-setup";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("opening draws and lethal Archery hits", () => {
  it("keeps opening-effect draws ahead of the ordinary opening draw without losing queued cards", () => {
    const older = makeTestCard({ id: "older", uid: 7 });
    const state = regressionBattle({
      hand: Array.from({ length: MAX_HAND_SIZE }, (_, uid) => makeTestCard({ id: `hand-${uid}`, uid })),
      pendingHandCards: [older],
      deck: Array.from({ length: 4 }, (_, index) => makeTestCard({ id: `draw-${index}` })),
      nextCardUid: 8,
    });
    const next = drawOpeningHand(state);
    expect(next.pendingHandCards.map((card) => card.id)).toEqual(["older", "draw-3", "draw-2", "draw-1", "draw-0"]);
    expect(next.hand).toEqual(state.hand);
    expect(next.deck).toHaveLength(0);
    expect(state.pendingHandCards).toEqual([older]);
  });

  it("does not spend battle RNG on an extra Archery hit after the first hit kills", () => {
    const card = makeTestCard({
      tags: ["archery"],
      effects: [{ kind: "damage", damageType: "physical", amount: 4, lifesteal: true }],
    });
    const rng = vi.fn(() => 0.99);
    const state = regressionBattle({
      rng,
      hand: [card],
      enemyHealth: 2,
      playerHealth: 10,
      playerMaxHealth: 40,
      talentEffects: { archeryPlayTwiceChance: 50 },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.playerHealth).toBe(12);
    // The attack rolls Dodge and Crit; a defeated target cannot roll Split Shot.
    expect(rng).toHaveBeenCalledTimes(2);
    expect(result.combatTexts.filter((event) => event.target === "enemy" && event.stat === "physical")).toEqual([
      expect.objectContaining({ kind: "damage", amount: 4 }),
    ]);
  });
});
