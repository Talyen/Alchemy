import { describe, expect, it } from "vitest";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { deliverPendingHandCards } from "@/lib/battle/draw";
import { computeEffectiveCost } from "@/lib/battle/card-cost-rules";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { cardById } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCard, regressionBattle } from "../../fixtures/battle";

describe("Gear rewards across turn boundaries", () => {
  it("Returning Flight queues the recovered arrow with its discount when the hand is full", () => {
    const arrow = { ...cardById["fire-arrow"]!, uid: 42, cost: 2 };
    const state = regressionBattle({
      hand: Array.from({ length: MAX_HAND_SIZE }, (_, uid) => makeTestCard({ uid })),
      discard: [arrow],
      uniqueGear: { lastArcheryUid: 42 },
      gearEffects: { recoverLastArcheryCard: 1 },
    });
    const next = advanceToPlayerTurn(state);
    expect(next.pendingHandCards).toHaveLength(1);
    expect(next.discard).toHaveLength(0);
    const delivered = deliverPendingHandCards({ ...next, hand: next.hand.slice(1) });
    const recovered = delivered.hand.at(-1)!;
    expect(recovered.id).toBe(arrow.id);
    expect(computeEffectiveCost(delivered, recovered).effectiveCost).toBe(1);
    expect(state.discard).toEqual([arrow]);
  });

  it("Frigid increases fixed Talent hits against Frozen enemies", () => {
    const state = regressionBattle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyCC: { freezeSkipTurns: 1 },
      gearEffects: { frozenEnemyDamageBonusPercent: 50 },
    });
    const next = resolveFollowUpHit(state, { source: "talent-fixed", damageType: "burn", amount: 4 }, []);
    expect(next.enemyHealth).toBe(94);
  });

  it("Ironbriar does not reward Block newly granted by a turn-start Purge", () => {
    const state = regressionBattle({
      playerStatuses: { block: 0 },
      enemyMitigation: { armor: 2 },
      gearEffects: { turnStartPurgeChance: 100, blockOnPurge: 3, thornsOnRetainedBlock: 2 },
      hand: [cardById.slash!],
    });
    const next = advanceToPlayerTurn(state);
    expect(next.playerStatuses.block).toBe(3);
    expect(next.playerStatuses.thorns).toBe(0);
    const retained = advanceToPlayerTurn({ ...state, playerStatuses: { ...state.playerStatuses, block: 4 } });
    expect(retained.playerStatuses.thorns).toBe(2);
  });
});
