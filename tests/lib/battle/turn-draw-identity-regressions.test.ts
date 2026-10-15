import { describe, expect, it } from "vitest";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById } from "@/lib/game-data";
import { regressionBattle } from "../../fixtures/battle";

describe("queued Returning Flight discounts", () => {
  const arrow = (uid: number) => ({ ...cardById["bounty-shot"]!, uid, cost: 2 });
  it("keeps the discount until a queued card's first playable turn", () => {
    const state = regressionBattle({
      hand: Array.from({ length: 7 }, (_, i) => arrow(i)),
      discard: [arrow(12)],
      nextCardUid: 20,
      gearEffects: { recoverLastArcheryCard: 1 },
      uniqueGear: { lastArcheryUid: 12 },
      enemyCC: { stunSkipTurns: 2 },
    });
    const recovered = advanceToPlayerTurn(state);
    expect(recovered.pendingHandCards).toHaveLength(1);
    const next = endPlayerTurn(recovered).state;
    const card = next.hand[0]!;
    expect(computeEffectiveCost(next, card).effectiveCost).toBe(1);
    const played = playBattleCardResolved({ ...next, mana: 1 }, card.id, 0).state;
    expect(played.mana).toBe(0);
    expect(played.uniqueGear.returningFlightUids).toEqual([]);
  });
  it("retains older queued discounts alongside a later recovery and expires discarded ones", () => {
    const state = regressionBattle({
      hand: Array.from({ length: 7 }, (_, i) => arrow(i)),
      pendingHandCards: [arrow(11)],
      discard: [arrow(12), arrow(13)],
      nextCardUid: 20,
      gearEffects: { recoverLastArcheryCard: 1 },
      uniqueGear: { returningFlightUids: [11, 13], lastArcheryUid: 12 },
    });
    const next = advanceToPlayerTurn(state);
    expect(next.uniqueGear.returningFlightUids).toEqual([11, next.pendingHandCards.at(-1)!.uid]);
    expect(next.pendingHandCards.map((card) => computeEffectiveCost(next, card).effectiveCost)).toEqual([1, 2, 1]);
  });
});
