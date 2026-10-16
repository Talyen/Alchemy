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
  it("keeps an earlier queued discount when another Archery card is recovered next turn", () => {
    const state = regressionBattle({
      hand: Array.from({ length: 7 }, (_, i) => ({ ...arrow(i), consume: false })),
      pendingHandCards: Array.from({ length: 15 }, (_, i) => arrow(100 + i)),
      discard: [arrow(12)],
      nextCardUid: 200,
      gearEffects: { recoverLastArcheryCard: 1 },
      uniqueGear: { lastArcheryUid: 12 },
      enemyCC: { stunSkipTurns: 3 },
    });
    const firstTurn = advanceToPlayerTurn(state);
    const firstUid = firstTurn.uniqueGear.returningFlightUids[0]!;
    const played = playBattleCardResolved(firstTurn, firstTurn.hand[0]!.id, 0).state;
    const next = endPlayerTurn(played).state;
    expect(next.uniqueGear.returningFlightUids).toHaveLength(2);
    expect(next.uniqueGear.returningFlightUids).toContain(firstUid);
    for (const uid of next.uniqueGear.returningFlightUids) {
      const recovered = next.pendingHandCards.find((card) => card.uid === uid)!;
      expect(recovered).toBeDefined();
      expect(computeEffectiveCost(next, recovered).effectiveCost).toBe(1);
    }
  });

  it("expires a discarded discount even if an ordinary draw returns the card", () => {
    const state = regressionBattle({
      discard: [arrow(13)],
      nextCardUid: 20,
      gearEffects: { recoverLastArcheryCard: 1 },
      uniqueGear: { returningFlightUids: [13] },
    });
    const next = advanceToPlayerTurn(state);
    expect(next.uniqueGear.returningFlightUids).toEqual([]);
    expect(computeEffectiveCost(next, next.hand[0]!).effectiveCost).toBe(2);
  });
});
